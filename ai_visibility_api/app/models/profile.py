from app.extensions import db
from app.models.base import UUIDPrimaryKeyMixin, TimestampMixin


class BusinessProfile(UUIDPrimaryKeyMixin, TimestampMixin, db.Model):
    __tablename__ = "business_profiles"

    name = db.Column(db.String(255), nullable=False)
    domain = db.Column(db.String(255), nullable=False, index=True)
    industry = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)

    # Stored as JSON rather than a separate Competitor table: competitors are
    # a small, unordered list of domain strings with no independent identity
    # or attributes of their own (no scoring, no relationships back to them).
    # Normalising them into their own table would add a join for zero
    # query-pattern benefit here. If competitors ever needed their own
    # tracked metrics, this would be the first thing to split out.
    competitors = db.Column(db.JSON, nullable=False, default=list)

    status = db.Column(db.String(32), nullable=False, default="created")

    runs = db.relationship(
        "PipelineRun", backref="profile", lazy="dynamic", cascade="all, delete-orphan"
    )
    queries = db.relationship(
        "DiscoveredQuery", backref="profile", lazy="dynamic", cascade="all, delete-orphan"
    )
    recommendations = db.relationship(
        "ContentRecommendation",
        backref="profile",
        lazy="dynamic",
        cascade="all, delete-orphan",
    )

    def to_dict(self):
        return {
            "profile_uuid": self.uuid,
            "name": self.name,
            "domain": self.domain,
            "industry": self.industry,
            "description": self.description,
            "competitors": self.competitors or [],
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def to_dict_with_stats(self):
        data = self.to_dict()
        data["stats"] = {
            "total_queries_discovered": self.queries.count(),
            "avg_opportunity_score": self._avg_opportunity_score(),
            "total_pipeline_runs": self.runs.count(),
            "total_recommendations": self.recommendations.count(),
        }
        return data

    def _avg_opportunity_score(self):
        from app.models.query import DiscoveredQuery

        result = (
            db.session.query(db.func.avg(DiscoveredQuery.opportunity_score))
            .filter(DiscoveredQuery.profile_uuid == self.uuid)
            .scalar()
        )
        return round(float(result), 4) if result is not None else None

    def share_of_voice(self):
        """Real "you vs. each competitor" visibility comparison, derived
        from Agent 2's per-query judgments -- NOT fabricated percentages.

        For each entity (this business + every listed competitor), the
        percentage is: (queries where that entity was judged visible) /
        (total discovered queries for this profile) * 100. Entities the
        scoring agent hasn't judged for a given query (e.g. a competitor
        added after that query was last scored) simply count as
        not-visible for it -- there's no partial/unknown state here since
        `competitor_visibility` defaults every listed competitor to a
        boolean each time a query is scored.
        """
        from app.models.query import DiscoveredQuery

        queries = DiscoveredQuery.query.filter_by(profile_uuid=self.uuid).all()
        total = len(queries)

        you_visible = sum(1 for q in queries if q.domain_visible is True)
        entities = [
            {
                "name": self.name,
                "is_you": True,
                "visible_count": you_visible,
                "total_queries": total,
                "share_pct": round(100 * you_visible / total, 1) if total else None,
            }
        ]

        for competitor in self.competitors or []:
            competitor_visible = sum(
                1 for q in queries if (q.competitor_visibility or {}).get(competitor) is True
            )
            entities.append(
                {
                    "name": competitor,
                    "is_you": False,
                    "visible_count": competitor_visible,
                    "total_queries": total,
                    "share_pct": round(100 * competitor_visible / total, 1) if total else None,
                }
            )

        entities.sort(key=lambda e: (e["share_pct"] is None, -(e["share_pct"] or 0)))
        return entities
