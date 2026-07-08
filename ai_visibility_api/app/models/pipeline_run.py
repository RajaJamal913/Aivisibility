from app.extensions import db
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class PipelineRun(UUIDPrimaryKeyMixin, db.Model):
    __tablename__ = "pipeline_runs"

    profile_uuid = db.Column(
        db.String(36), db.ForeignKey("business_profiles.uuid"), nullable=False, index=True
    )

    status = db.Column(db.String(32), nullable=False, default="running")
    # running -> completed | failed | partial (Agent 2 had per-query failures
    # but the run overall produced usable output)

    queries_discovered = db.Column(db.Integer, nullable=False, default=0)
    queries_scored = db.Column(db.Integer, nullable=False, default=0)
    recommendations_generated = db.Column(db.Integer, nullable=False, default=0)
    tokens_used = db.Column(db.Integer, nullable=True)
    data_provider_used = db.Column(db.String(32), nullable=True)  # "dataforseo" | "mock"
    error_message = db.Column(db.Text, nullable=True)

    started_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    queries = db.relationship("DiscoveredQuery", backref="run", lazy="dynamic")

    def to_dict(self):
        return {
            "run_uuid": self.uuid,
            "profile_uuid": self.profile_uuid,
            "status": self.status,
            "queries_discovered": self.queries_discovered,
            "queries_scored": self.queries_scored,
            "recommendations_generated": self.recommendations_generated,
            "tokens_used": self.tokens_used,
            "data_provider_used": self.data_provider_used,
            "error_message": self.error_message,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
