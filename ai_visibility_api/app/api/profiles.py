from flask import Blueprint, request, jsonify

from app.extensions import db, limiter
from app.models import BusinessProfile, DiscoveredQuery, ContentRecommendation, PipelineRun
from app.schemas import CreateProfileSchema, validate_payload
from app.errors import NotFoundError, ValidationError
from app.services.factory import build_orchestrator

profiles_bp = Blueprint("profiles", __name__, url_prefix="/api/v1/profiles")


def _get_profile_or_404(profile_uuid: str) -> BusinessProfile:
    profile = db.session.get(BusinessProfile, profile_uuid)
    if profile is None:
        raise NotFoundError(f"Profile '{profile_uuid}' was not found.")
    return profile


@profiles_bp.post("")
def create_profile():
    data = validate_payload(CreateProfileSchema(), request.get_json(silent=True))

    profile = BusinessProfile(
        name=data["name"],
        domain=data["domain"],
        industry=data["industry"],
        description=data.get("description"),
        competitors=data.get("competitors") or [],
        status="created",
    )
    db.session.add(profile)
    db.session.commit()

    return jsonify(profile.to_dict()), 201


@profiles_bp.get("")
def list_profiles():
    """Lists all registered business profiles with summary stats.

    Not part of Task 1's original endpoint spec (which only defined
    create + get-by-uuid), but required by Task 2's Dashboard screen
    ("List of all registered business profiles with summary cards").
    Added here rather than leaving the frontend to fake it client-side,
    since profile data legitimately lives server-side.
    """
    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=20, type=int)
    if page < 1 or per_page < 1 or per_page > 100:
        raise ValidationError("'page' must be >= 1 and 'per_page' must be between 1 and 100.")

    pagination = BusinessProfile.query.order_by(BusinessProfile.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify(
        {
            "profiles": [p.to_dict_with_stats() for p in pagination.items],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total_items": pagination.total,
                "total_pages": pagination.pages,
            },
        }
    ), 200


@profiles_bp.get("/<profile_uuid>")
def get_profile(profile_uuid: str):
    profile = _get_profile_or_404(profile_uuid)
    return jsonify(profile.to_dict_with_stats()), 200


@profiles_bp.post("/<profile_uuid>/run")
@limiter.limit("5 per minute")  # bonus: rate limiting on the expensive pipeline trigger
def run_pipeline(profile_uuid: str):
    profile = _get_profile_or_404(profile_uuid)

    orchestrator = build_orchestrator()
    run = orchestrator.run(profile)

    top_queries = (
        DiscoveredQuery.query.filter_by(run_uuid=run.uuid)
        .order_by(DiscoveredQuery.opportunity_score.desc())
        .limit(3)
        .all()
    )
    recommendations = ContentRecommendation.query.filter_by(run_uuid=run.uuid).all()

    response = run.to_dict()
    response["top_opportunity_queries"] = [q.to_dict() for q in top_queries]
    response["content_recommendations"] = [r.to_dict() for r in recommendations]

    status_code = 200 if run.status in ("completed", "partial") else 502
    return jsonify(response), status_code


@profiles_bp.get("/<profile_uuid>/share-of-voice")
def get_share_of_voice(profile_uuid: str):
    """Real "Your Brand vs Competitors" visibility comparison.

    Not part of Task 1's original endpoint spec, but added to back the
    frontend's Share of Voice chart with genuine data instead of a
    fabricated per-competitor percentage: Agent 2 judges every listed
    competitor's visibility for each query alongside the target's own (see
    `DiscoveredQuery.competitor_visibility`), and this aggregates that into
    a per-entity share of queries where each business was judged visible.
    """
    profile = _get_profile_or_404(profile_uuid)
    return jsonify({"entities": profile.share_of_voice()}), 200


@profiles_bp.get("/<profile_uuid>/runs")
def list_pipeline_runs(profile_uuid: str):
    """Lists all pipeline runs for a profile, most recent first.

    Not part of Task 1's original endpoint spec (which only returns a
    single run's result inline from POST .../run), but required by Task
    2's "Pipeline Run History" screen ("Timeline or table of all pipeline
    runs for a profile"). The PipelineRun model already tracks everything
    needed (status, timestamps, counts, tokens) -- this just exposes it.
    """
    _get_profile_or_404(profile_uuid)

    page = request.args.get("page", default=1, type=int)
    per_page = request.args.get("per_page", default=20, type=int)
    if page < 1 or per_page < 1 or per_page > 100:
        raise ValidationError("'page' must be >= 1 and 'per_page' must be between 1 and 100.")

    pagination = (
        PipelineRun.query.filter_by(profile_uuid=profile_uuid)
        .order_by(PipelineRun.started_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify(
        {
            "runs": [r.to_dict() for r in pagination.items],
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total_items": pagination.total,
                "total_pages": pagination.pages,
            },
        }
    ), 200
