from flask import Blueprint, request, jsonify

from app.extensions import db
from app.models import BusinessProfile, DiscoveredQuery, ContentRecommendation
from app.errors import NotFoundError, ValidationError
from app.services.factory import build_scoring_agent
from app.agents.scoring import VisibilityScoringAgent
from app.utils.scoring import calculate_opportunity_score
from app.models.base import utcnow

queries_bp = Blueprint("queries", __name__, url_prefix="/api/v1")

VALID_VISIBILITY_STATUSES = {"visible", "not_visible", "unknown"}


def _get_profile_or_404(profile_uuid: str) -> BusinessProfile:
    profile = db.session.get(BusinessProfile, profile_uuid)
    if profile is None:
        raise NotFoundError(f"Profile '{profile_uuid}' was not found.")
    return profile


def _get_query_or_404(query_uuid: str) -> DiscoveredQuery:
    query = db.session.get(DiscoveredQuery, query_uuid)
    if query is None:
        raise NotFoundError(f"Query '{query_uuid}' was not found.")
    return query


@queries_bp.get("/profiles/<profile_uuid>/queries")
def list_queries(profile_uuid: str):
    _get_profile_or_404(profile_uuid)

    query = DiscoveredQuery.query.filter_by(profile_uuid=profile_uuid)

    min_score = request.args.get("min_score", type=float)
    if min_score is not None:
        query = query.filter(DiscoveredQuery.opportunity_score >= min_score)

    status = request.args.get("status")
    if status is not None:
        if status not in VALID_VISIBILITY_STATUSES:
            raise ValidationError(
                f"Invalid status '{status}'. Must be one of: {', '.join(sorted(VALID_VISIBILITY_STATUSES))}."
            )
        if status == "visible":
            query = query.filter(DiscoveredQuery.domain_visible.is_(True))
        elif status == "not_visible":
            query = query.filter(DiscoveredQuery.domain_visible.is_(False))
        else:  # unknown
            query = query.filter(DiscoveredQuery.domain_visible.is_(None))

    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=20, type=int)
    if page < 1 or per_page < 1 or per_page > 100:
        raise ValidationError("'page' must be >= 1 and 'per_page' must be between 1 and 100.")

    query = query.order_by(DiscoveredQuery.opportunity_score.desc().nullslast())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify(
        {
            "queries": [q.to_dict() for q in pagination.items],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total_items": pagination.total,
                "total_pages": pagination.pages,
            },
        }
    ), 200


@queries_bp.get("/profiles/<profile_uuid>/recommendations")
def list_recommendations(profile_uuid: str):
    _get_profile_or_404(profile_uuid)

    recommendations = (
        ContentRecommendation.query.filter_by(profile_uuid=profile_uuid)
        .order_by(ContentRecommendation.created_at.desc())
        .all()
    )
    return jsonify({"recommendations": [r.to_dict() for r in recommendations]}), 200


@queries_bp.post("/queries/<query_uuid>/recheck")
def recheck_query(query_uuid: str):
    query_row = _get_query_or_404(query_uuid)
    profile = _get_profile_or_404(query_row.profile_uuid)

    scoring_agent: VisibilityScoringAgent = build_scoring_agent()

    parsed, tokens_used = scoring_agent.run(
        query_text=query_row.query_text,
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

    query_row.domain_visible = parsed.get("domain_visible")
    query_row.visibility_position = parsed.get("visibility_position")
    query_row.competitor_visibility = parsed.get("competitor_visibility") or {}
    query_row.scoring_llm_provider = scoring_agent.llm_client.provider
    query_row.scoring_llm_model = scoring_agent.llm_client.model
    query_row.confidence_reasoning = parsed.get("confidence_reasoning")
    query_row.scoring_error = scoring_error
    query_row.opportunity_score = calculate_opportunity_score(
        estimated_search_volume=query_row.estimated_search_volume,
        competitive_difficulty=query_row.competitive_difficulty,
        domain_visible=query_row.domain_visible,
        visibility_position=query_row.visibility_position,
        query_intent=query_row.query_intent,
    )
    query_row.last_scored_at = utcnow()
    db.session.commit()

    return jsonify({"query": query_row.to_dict(), "tokens_used": tokens_used}), 200
