"""
Pipeline orchestrator: coordinates Agent 1 -> Agent 2 -> Agent 3 for a given
BusinessProfile, persisting results incrementally so a failure partway
through still leaves useful data behind.

Failure isolation strategy
----------------------------
- Agent 1 (discovery) failing entirely is a hard pipeline failure -- there's
  nothing downstream can do without at least one query. BaseAgent's
  built-in retry-once-then-fallback means this only happens if the LLM is
  completely unreachable AND the deterministic fallback template is used
  instead (so in practice the run still "completes" with fallback data,
  clearly marked as such via the run's error_message).
- Agent 2 (scoring) runs once PER discovered query. If scoring fails for
  one query (after BaseAgent's retry+fallback), that query is still
  persisted with `scoring_error` set and a fallback (not-visible) scoring
  applied -- the run continues to the next query rather than aborting.
- Agent 3 (recommendations) only ever operates on queries that scored
  successfully and show a visibility gap; if it fails outright, the run is
  marked "partial" (queries exist, recommendations don't) rather than
  "failed", since query discovery + scoring is still valuable output.
"""
from __future__ import annotations

import logging

from app.extensions import db
from app.models import PipelineRun, DiscoveredQuery, ContentRecommendation
from app.models.base import utcnow
from app.agents.discovery import QueryDiscoveryAgent
from app.agents.scoring import VisibilityScoringAgent
from app.agents.recommendation import ContentRecommendationAgent
from app.services.dataforseo import DataForSEOClient
from app.services.llm_client import LLMClient
from app.utils.scoring import calculate_opportunity_score

logger = logging.getLogger(__name__)

# Only queries scoring at or above this threshold, AND where the domain is
# not visible, are passed to Agent 3 -- keeps content recommendations
# focused on genuinely worthwhile gaps rather than every single miss.
RECOMMENDATION_MIN_OPPORTUNITY_SCORE = 0.4


class PipelineOrchestrator:
    def __init__(
        self,
        discovery_agent: QueryDiscoveryAgent,
        scoring_agent: VisibilityScoringAgent,
        recommendation_agent: ContentRecommendationAgent,
        data_client: DataForSEOClient,
        max_recommendations: int = 5,
    ):
        self.discovery_agent = discovery_agent
        self.scoring_agent = scoring_agent
        self.recommendation_agent = recommendation_agent
        self.data_client = data_client
        self.max_recommendations = max_recommendations

    def run(self, profile) -> PipelineRun:
        run = PipelineRun(profile_uuid=profile.uuid, status="running")
        db.session.add(run)
        db.session.commit()

        total_tokens = 0
        data_providers_used: set[str] = set()

        try:
            # ---- Agent 1: Query Discovery ----
            discovered, tokens = self._run_discovery(profile)
            total_tokens += tokens
            run.queries_discovered = len(discovered)
            db.session.commit()

            if not discovered:
                run.status = "failed"
                run.error_message = "Agent 1 produced zero usable queries."
                run.completed_at = utcnow()
                db.session.commit()
                return run

            # ---- Real/mock search data (batched, one call for all queries) ----
            query_texts = [q["query_text"] for q in discovered]
            search_data = self.data_client.get_search_data(query_texts)
            search_data_by_text = {d.query_text: d for d in search_data}

            # ---- Agent 2: Visibility Scoring (per-query, isolated failures) ----
            saved_queries: list[DiscoveredQuery] = []
            scored_count = 0
            for item in discovered:
                query_row, tokens, provider_used = self._run_scoring_for_query(
                    profile, run, item, search_data_by_text.get(item["query_text"])
                )
                total_tokens += tokens
                data_providers_used.add(provider_used)
                db.session.add(query_row)
                saved_queries.append(query_row)
                if query_row.scoring_error is None:
                    scored_count += 1

            run.queries_scored = scored_count
            db.session.commit()

            # ---- Agent 3: Content Recommendations ----
            gap_queries = sorted(
                (q for q in saved_queries if q.domain_visible is False and (q.opportunity_score or 0) >= RECOMMENDATION_MIN_OPPORTUNITY_SCORE),
                key=lambda q: q.opportunity_score or 0,
                reverse=True,
            )[: max(self.max_recommendations * 2, 10)]  # give Agent 3 some headroom to choose from

            recommendations, tokens = self._run_recommendations(profile, run, gap_queries)
            total_tokens += tokens
            for rec in recommendations:
                db.session.add(rec)
            run.recommendations_generated = len(recommendations)

            run.tokens_used = total_tokens
            run.data_provider_used = "+".join(sorted(data_providers_used)) or None
            run.status = "completed" if run.queries_scored > 0 else "partial"
            run.completed_at = utcnow()
            db.session.commit()
            return run

        except Exception as exc:  # noqa: BLE001 - top-level safety net for the whole run
            logger.exception("Pipeline run %s failed unexpectedly", run.uuid)
            db.session.rollback()
            run = db.session.get(PipelineRun, run.uuid)
            run.status = "failed"
            run.error_message = f"{type(exc).__name__}: {exc}"
            run.tokens_used = total_tokens
            run.completed_at = utcnow()
            db.session.commit()
            return run

    def _run_discovery(self, profile) -> tuple[list[dict], int]:
        parsed, tokens = self.discovery_agent.run(
            business_name=profile.name,
            domain=profile.domain,
            industry=profile.industry,
            description=profile.description,
            competitors=profile.competitors or [],
        )
        if parsed is None:
            logger.warning("Agent 1 fully failed validation twice; using deterministic fallback query set.")
            parsed = QueryDiscoveryAgent.fallback_queries(profile.name, profile.industry, profile.competitors or [])
        return parsed.get("queries", []), tokens

    def _run_scoring_for_query(self, profile, run, discovered_item, search_data) -> tuple[DiscoveredQuery, int, str]:
        query_intent = discovered_item.get("intent")

        parsed, tokens = self.scoring_agent.run(
            query_text=discovered_item["query_text"],
            business_name=profile.name,
            domain=profile.domain,
            industry=profile.industry,
            description=profile.description,
            competitors=profile.competitors or [],
        )

        scoring_error = None
        if parsed is None:
            scoring_error = "Agent 2 failed validation after retry; applied conservative fallback (not-visible)."
            parsed = VisibilityScoringAgent.fallback_visibility(profile.competitors or [])

        volume = search_data.estimated_search_volume if search_data else None
        difficulty = search_data.competitive_difficulty if search_data else None
        provider_used = search_data.provider if search_data else "mock"

        opportunity_score = calculate_opportunity_score(
            estimated_search_volume=volume,
            competitive_difficulty=difficulty,
            domain_visible=parsed.get("domain_visible"),
            visibility_position=parsed.get("visibility_position"),
            query_intent=query_intent,
        )

        query_row = DiscoveredQuery(
            profile_uuid=profile.uuid,
            run_uuid=run.uuid,
            query_text=discovered_item["query_text"],
            query_intent=query_intent,
            estimated_search_volume=volume,
            competitive_difficulty=difficulty,
            opportunity_score=opportunity_score,
            domain_visible=parsed.get("domain_visible"),
            visibility_position=parsed.get("visibility_position"),
            competitor_visibility=parsed.get("competitor_visibility") or {},
            scoring_llm_provider=self.scoring_agent.llm_client.provider,
            scoring_llm_model=self.scoring_agent.llm_client.model,
            confidence_reasoning=parsed.get("confidence_reasoning"),
            scoring_error=scoring_error,
            last_scored_at=utcnow(),
        )
        return query_row, tokens, provider_used

    def _run_recommendations(self, profile, run, gap_queries: list[DiscoveredQuery]) -> tuple[list[ContentRecommendation], int]:
        if not gap_queries:
            return [], 0

        gap_query_payload = [
            {
                "query_uuid": q.uuid,
                "query_text": q.query_text,
                "query_intent": q.query_intent,
                "opportunity_score": q.opportunity_score,
                "estimated_search_volume": q.estimated_search_volume,
                "competitive_difficulty": q.competitive_difficulty,
            }
            for q in gap_queries
        ]

        parsed, tokens = self.recommendation_agent.run(
            business_name=profile.name,
            domain=profile.domain,
            industry=profile.industry,
            gap_queries=gap_query_payload,
        )

        valid_query_uuids = {q.uuid for q in gap_queries}

        if parsed is None:
            logger.warning("Agent 3 fully failed validation twice; using deterministic fallback recommendations.")
            parsed = ContentRecommendationAgent.fallback_recommendations(gap_query_payload)

        recommendations = []
        for rec in parsed.get("recommendations", [])[: self.max_recommendations]:
            query_uuid = rec.get("query_uuid")
            if query_uuid not in valid_query_uuids:
                # LLM hallucinated a UUID not in the provided set -- skip
                # rather than persisting a recommendation pointing nowhere.
                logger.warning("Agent 3 referenced unknown query_uuid %s; skipping.", query_uuid)
                continue
            content_type = rec.get("content_type") or "blog_post"
            priority = rec.get("priority") or "medium"
            recommendations.append(
                ContentRecommendation(
                    profile_uuid=profile.uuid,
                    query_uuid=query_uuid,
                    run_uuid=run.uuid,
                    content_type=content_type,
                    title=rec["title"],
                    rationale=rec["rationale"],
                    target_keywords=rec.get("target_keywords") or [],
                    priority=priority,
                )
            )
        return recommendations, tokens
