from app.extensions import db
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class DiscoveredQuery(UUIDPrimaryKeyMixin, db.Model):
    __tablename__ = "discovered_queries"

    profile_uuid = db.Column(
        db.String(36), db.ForeignKey("business_profiles.uuid"), nullable=False, index=True
    )
    run_uuid = db.Column(
        db.String(36), db.ForeignKey("pipeline_runs.uuid"), nullable=False, index=True
    )

    query_text = db.Column(db.Text, nullable=False)
    query_intent = db.Column(db.String(32), nullable=True)
    # e.g. "comparison", "best_of", "how_to", "informational" -- set by Agent 1,
    # consumed by the opportunity-score formula's commercial-intent weight.

    estimated_search_volume = db.Column(db.Integer, nullable=True)
    competitive_difficulty = db.Column(db.Integer, nullable=True)  # 0-100
    opportunity_score = db.Column(db.Float, nullable=True, index=True)  # 0.0-1.0

    domain_visible = db.Column(db.Boolean, nullable=True)
    visibility_position = db.Column(db.Integer, nullable=True)

    # {competitor_domain: bool} -- Agent 2 judges every listed competitor's
    # visibility for this same query in the same call. This is what backs
    # a real (not fabricated) "Your Brand vs Competitors" comparison.
    competitor_visibility = db.Column(db.JSON, nullable=True)

    # Which LLM actually performed this query's scoring judgment -- real
    # provider/model config, not a per-query "AI engine" concept the
    # pipeline doesn't otherwise have. Surfaced in the frontend as the
    # mentions table's Platform column.
    scoring_llm_provider = db.Column(db.String(32), nullable=True)
    scoring_llm_model = db.Column(db.String(64), nullable=True)

    # Agent 2 already generates this one-sentence judgment for every query
    # (see agents/scoring.py's `confidence_reasoning` field) but it was
    # previously discarded after validation. Persisting it gives the API
    # a real, non-fabricated "why" behind each visibility call, surfaced
    # in the frontend as the mentions snippet/explanation.
    confidence_reasoning = db.Column(db.Text, nullable=True)

    scoring_error = db.Column(db.Text, nullable=True)
    # Populated when Agent 2 could not score this specific query (partial
    # failure isolation) so the row still exists and is visible via the API
    # instead of silently vanishing.

    discovered_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    last_scored_at = db.Column(db.DateTime(timezone=True), nullable=True)

    recommendations = db.relationship(
        "ContentRecommendation",
        backref="target_query",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    @property
    def visibility_status(self) -> str:
        if self.domain_visible is None:
            return "unknown"
        return "visible" if self.domain_visible else "not_visible"

    def to_dict(self):
        return {
            "query_uuid": self.uuid,
            "profile_uuid": self.profile_uuid,
            "run_uuid": self.run_uuid,
            "query_text": self.query_text,
            "query_intent": self.query_intent,
            "estimated_search_volume": self.estimated_search_volume,
            "competitive_difficulty": self.competitive_difficulty,
            "opportunity_score": self.opportunity_score,
            "domain_visible": self.domain_visible,
            "visibility_position": self.visibility_position,
            "visibility_status": self.visibility_status,
            "competitor_visibility": self.competitor_visibility or {},
            "scoring_llm_provider": self.scoring_llm_provider,
            "scoring_llm_model": self.scoring_llm_model,
            "confidence_reasoning": self.confidence_reasoning,
            "scoring_error": self.scoring_error,
            "discovered_at": self.discovered_at.isoformat(),
            "last_scored_at": self.last_scored_at.isoformat() if self.last_scored_at else None,
        }
