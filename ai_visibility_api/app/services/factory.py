"""
Builds agent/orchestrator instances from the current Flask app's config.
Kept separate from pipeline.py so routes can build a lightweight
single-agent instance (e.g. for the /recheck endpoint, which only needs
the scoring agent) without constructing the full orchestrator.
"""
from flask import current_app

from app.agents.discovery import QueryDiscoveryAgent
from app.agents.scoring import VisibilityScoringAgent
from app.agents.recommendation import ContentRecommendationAgent
from app.services.dataforseo import build_dataforseo_client
from app.services.llm_client import build_llm_client
from app.services.pipeline import PipelineOrchestrator


def build_discovery_agent() -> QueryDiscoveryAgent:
    cfg = current_app.config
    client = build_llm_client(cfg["DISCOVERY_AGENT_PROVIDER"], cfg["DISCOVERY_AGENT_MODEL"], _cfg_obj(cfg))
    return QueryDiscoveryAgent(client)


def build_scoring_agent() -> VisibilityScoringAgent:
    cfg = current_app.config
    client = build_llm_client(cfg["SCORING_AGENT_PROVIDER"], cfg["SCORING_AGENT_MODEL"], _cfg_obj(cfg))
    return VisibilityScoringAgent(client)


def build_recommendation_agent() -> ContentRecommendationAgent:
    cfg = current_app.config
    client = build_llm_client(cfg["RECOMMENDATION_AGENT_PROVIDER"], cfg["RECOMMENDATION_AGENT_MODEL"], _cfg_obj(cfg))
    return ContentRecommendationAgent(client)


def build_orchestrator() -> PipelineOrchestrator:
    cfg = current_app.config
    data_client = build_dataforseo_client(_cfg_obj(cfg))
    return PipelineOrchestrator(
        discovery_agent=build_discovery_agent(),
        scoring_agent=build_scoring_agent(),
        recommendation_agent=build_recommendation_agent(),
        data_client=data_client,
        max_recommendations=cfg.get("MAX_RECOMMENDATIONS_PER_RUN", 5),
    )


def _cfg_obj(cfg):
    """Flask's app.config is dict-like; the dataforseo/llm builder helpers
    expect attribute access (`app_config.FOO`), so this adapts it."""

    class _Adapter:
        def __getattr__(self, item):
            return cfg.get(item)

    return _Adapter()
