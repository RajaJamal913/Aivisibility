"""
Agent 3 -- Content Recommendation Agent

Responsibility: given the top-scoring queries where the target domain is
NOT currently appearing, generate 3-5 specific, actionable content
recommendations that would close that visibility gap.
"""
from __future__ import annotations

from app.agents.base import BaseAgent

VALID_CONTENT_TYPES = {"blog_post", "landing_page", "faq", "comparison_page", "case_study"}
VALID_PRIORITIES = {"high", "medium", "low"}


class ContentRecommendationAgent(BaseAgent):
    name = "content_recommendation_agent"
    max_tokens = 2500

    def system_prompt(self) -> str:
        return f"""You are a Content Recommendation Agent inside an AI-visibility research
platform. You are given a list of high-opportunity queries where a
business is currently NOT appearing in AI-generated answers. Your job is
to recommend specific, publishable content that would close each gap.

For each recommendation:
- Tie it to ONE specific query from the input list (reference it by its
  query_uuid exactly as given -- do not invent new UUIDs).
- `title` must be a specific, ready-to-use content title, not a generic
  placeholder (bad: "Blog post about the industry"; good: "Frase vs Surfer
  SEO: Which Is Better for Content Teams in 2025?").
- `rationale` must explain, in 1-2 sentences, WHY this specific content
  closes THIS specific query's visibility gap (reference the query's
  intent or competitive angle -- don't write generic SEO advice).
- `target_keywords` should be 3-6 specific keyword/topic phrases the
  content should cover, not single generic words.
- `content_type` must be exactly one of: {', '.join(sorted(VALID_CONTENT_TYPES))}.
- `priority` must be exactly one of: {', '.join(sorted(VALID_PRIORITIES))},
  based on the query's opportunity score (higher score -> higher priority).

Generate between 3 and 5 recommendations total, prioritizing the
highest-opportunity queries first. It is fine to skip lower-opportunity
queries from the input list if you've already covered the best ones.

Output format -- respond with ONLY a JSON object, no markdown fences, no
commentary, matching EXACTLY this schema:

{{
  "recommendations": [
    {{
      "query_uuid": "string, must exactly match one of the provided query_uuid values",
      "content_type": "one of: {', '.join(sorted(VALID_CONTENT_TYPES))}",
      "title": "string",
      "rationale": "string",
      "target_keywords": ["string", "..."],
      "priority": "one of: {', '.join(sorted(VALID_PRIORITIES))}"
    }}
  ]
}}

Return nothing but that JSON object."""

    def build_user_prompt(
        self,
        *,
        business_name: str,
        domain: str,
        industry: str,
        gap_queries: list[dict],
    ) -> str:
        lines = []
        for q in gap_queries:
            lines.append(
                f'- query_uuid: {q["query_uuid"]} | query_text: "{q["query_text"]}" | '
                f'intent: {q.get("query_intent") or "unknown"} | '
                f'opportunity_score: {q["opportunity_score"]} | '
                f'estimated_search_volume: {q.get("estimated_search_volume")} | '
                f'competitive_difficulty: {q.get("competitive_difficulty")}'
            )
        gap_query_block = "\n".join(lines)

        return f"""Target business: {business_name} ({domain}), industry: {industry}

High-opportunity queries where this business is currently NOT visible,
sorted by opportunity score descending:

{gap_query_block}

Generate the content recommendation set now."""

    def validate(self, parsed) -> bool:
        if not isinstance(parsed, dict):
            return False
        recs = parsed.get("recommendations")
        if not isinstance(recs, list) or not (1 <= len(recs) <= 10):
            return False
        for rec in recs:
            if not isinstance(rec, dict):
                return False
            if not isinstance(rec.get("query_uuid"), str) or not rec["query_uuid"].strip():
                return False
            if not isinstance(rec.get("title"), str) or not rec["title"].strip():
                return False
            if not isinstance(rec.get("rationale"), str) or not rec["rationale"].strip():
                return False
            if not isinstance(rec.get("target_keywords"), list):
                return False
        return True

    @staticmethod
    def fallback_recommendations(gap_queries: list[dict]) -> dict:
        """Deterministic template-based fallback if the LLM fails validation
        twice: still produces one usable recommendation per top gap query
        (capped at 5) rather than leaving Agent 3's output empty."""
        recs = []
        for q in gap_queries[:5]:
            recs.append(
                {
                    "query_uuid": q["query_uuid"],
                    "content_type": "blog_post",
                    "title": f'Answering: "{q["query_text"]}"',
                    "rationale": "fallback: LLM recommendation generation unavailable; "
                    "this query has a high opportunity score and no current visibility.",
                    "target_keywords": [q["query_text"]],
                    "priority": "high" if q["opportunity_score"] >= 0.7 else "medium",
                }
            )
        return {"recommendations": recs}
