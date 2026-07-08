"""
Unit tests for agent logic using mocked LLM responses (per the bonus-points
requirement). These tests never make a real network/LLM call -- BaseAgent's
LLMClient dependency is a duck-typed stub.
"""
from app.agents.discovery import QueryDiscoveryAgent
from app.agents.scoring import VisibilityScoringAgent
from app.agents.recommendation import ContentRecommendationAgent
from app.services.llm_client import LLMResponse


class StubLLMClient:
    """Duck-types LLMClient. `responses` is a list consumed in order across
    successive calls, so a test can script "bad response, then good
    response on retry" or "bad, bad" to hit the fallback path."""

    def __init__(self, responses: list[LLMResponse]):
        self._responses = list(responses)
        self.provider = "stub"
        self.model = "stub-model"
        self.call_count = 0

    def complete_json(self, system_prompt, user_prompt, max_tokens=2000):
        self.call_count += 1
        return self._responses.pop(0)


def _resp(parsed):
    return LLMResponse(parsed=parsed, raw_text="...", tokens_used=42, provider="stub", model="stub-model")


# ---------- QueryDiscoveryAgent ----------

def test_discovery_agent_accepts_valid_response():
    good = _resp({"queries": [{"query_text": "What is the best tool?", "intent": "best_of"}]})
    agent = QueryDiscoveryAgent(StubLLMClient([good]))
    result, tokens = agent.run(
        business_name="Acme", domain="acme.com", industry="SaaS",
        description="desc", competitors=["comp.com"],
    )
    assert result == good.parsed
    assert tokens == 42


def test_discovery_agent_retries_once_on_malformed_json_then_succeeds():
    bad = _resp(None)
    good = _resp({"queries": [{"query_text": "Q?", "intent": "how_to"}]})
    stub = StubLLMClient([bad, good])
    agent = QueryDiscoveryAgent(stub)
    result, tokens = agent.run(
        business_name="Acme", domain="acme.com", industry="SaaS",
        description="desc", competitors=[],
    )
    assert stub.call_count == 2
    assert result == good.parsed


def test_discovery_agent_returns_none_after_two_failures_and_fallback_is_usable():
    bad1 = _resp(None)
    bad2 = _resp({"totally": "wrong shape"})
    stub = StubLLMClient([bad1, bad2])
    agent = QueryDiscoveryAgent(stub)
    result, tokens = agent.run(
        business_name="Acme", domain="acme.com", industry="SaaS",
        description="desc", competitors=["comp.com"],
    )
    assert result is None

    fallback = QueryDiscoveryAgent.fallback_queries("Acme", "SaaS", ["comp.com"])
    assert len(fallback["queries"]) >= 3
    assert all(q["query_text"] for q in fallback["queries"])


def test_discovery_agent_rejects_empty_queries_list():
    agent = QueryDiscoveryAgent(StubLLMClient([]))
    assert agent.validate({"queries": []}) is False


def test_discovery_agent_rejects_non_dict():
    agent = QueryDiscoveryAgent(StubLLMClient([]))
    assert agent.validate(["not", "a", "dict"]) is False


# ---------- VisibilityScoringAgent ----------

def test_scoring_agent_accepts_valid_response():
    good = _resp({"domain_visible": True, "visibility_position": 2, "confidence_reasoning": "x"})
    agent = VisibilityScoringAgent(StubLLMClient([good]))
    result, tokens = agent.run(
        query_text="Q", business_name="Acme", domain="acme.com",
        industry="SaaS", description="d", competitors=[],
    )
    assert result["domain_visible"] is True
    assert result["visibility_position"] == 2


def test_scoring_agent_fallback_defaults_to_not_visible():
    fallback = VisibilityScoringAgent.fallback_visibility()
    assert fallback["domain_visible"] is False
    assert fallback["visibility_position"] is None


def test_scoring_agent_rejects_missing_domain_visible_field():
    agent = VisibilityScoringAgent(StubLLMClient([]))
    assert agent.validate({"visibility_position": 1}) is False


def test_scoring_agent_rejects_wrong_type_for_position():
    agent = VisibilityScoringAgent(StubLLMClient([]))
    assert agent.validate({"domain_visible": True, "visibility_position": "first"}) is False


# ---------- ContentRecommendationAgent ----------

def test_recommendation_agent_accepts_valid_response():
    good = _resp(
        {
            "recommendations": [
                {
                    "query_uuid": "q-1",
                    "content_type": "blog_post",
                    "title": "T",
                    "rationale": "R",
                    "target_keywords": ["k1", "k2"],
                    "priority": "high",
                }
            ]
        }
    )
    agent = ContentRecommendationAgent(StubLLMClient([good]))
    result, tokens = agent.run(
        business_name="Acme", domain="acme.com", industry="SaaS",
        gap_queries=[{"query_uuid": "q-1", "query_text": "Q", "opportunity_score": 0.8}],
    )
    assert result == good.parsed


def test_recommendation_agent_fallback_produces_one_rec_per_gap_query():
    gap_queries = [
        {"query_uuid": "q-1", "query_text": "Q1", "opportunity_score": 0.9},
        {"query_uuid": "q-2", "query_text": "Q2", "opportunity_score": 0.3},
    ]
    fallback = ContentRecommendationAgent.fallback_recommendations(gap_queries)
    assert len(fallback["recommendations"]) == 2
    assert fallback["recommendations"][0]["priority"] == "high"
    assert fallback["recommendations"][1]["priority"] == "medium"


def test_recommendation_agent_rejects_missing_required_fields():
    agent = ContentRecommendationAgent(StubLLMClient([]))
    assert agent.validate({"recommendations": [{"query_uuid": "q-1"}]}) is False
