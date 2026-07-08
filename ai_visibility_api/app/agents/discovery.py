"""
Agent 1 -- Query Discovery Agent

Responsibility: given a business profile, generate 10-20 realistic,
commercially-relevant natural-language questions that prospective
customers plausibly ask AI assistants (ChatGPT/Claude/Perplexity) while
researching this product category.
"""
from __future__ import annotations

from app.agents.base import BaseAgent

VALID_INTENTS = {"comparison", "best_of", "how_to", "informational", "definitional"}


class QueryDiscoveryAgent(BaseAgent):
    name = "query_discovery_agent"
    max_tokens = 3000

    def system_prompt(self) -> str:
        return f"""You are a Query Discovery Agent inside a B2B AI-visibility research
platform. Your sole job is to enumerate the realistic questions that a
prospective buyer would type into an AI assistant (ChatGPT, Claude,
Perplexity) while researching or comparing products in a specific software
category -- NOT generic SEO keywords, and NOT questions about the business
itself as a company (e.g. never "who founded X").

Requirements for every question you generate:
- Natural language, phrased the way a real user would type it into a chat
  assistant (not a search-engine keyword fragment).
- Commercially relevant: tied to purchase research, not idle curiosity.
- Cover a MIX of these five intents, spread across the set (not all one type):
  - "comparison": direct "X vs Y" style questions naming specific competitors
  - "best_of": "what is the best tool for..." style questions
  - "how_to": task-oriented questions the product category solves
  - "informational": category-education questions
  - "definitional": "what is [category/term]" questions
- Do not fabricate specific pricing, statistics, or claims within the
  question text itself -- the question should just be the question.
- Generate between 10 and 20 questions. Favor variety over repetition;
  do not produce near-duplicate phrasings of the same question.

Output format -- respond with ONLY a JSON object, no markdown fences, no
commentary, matching EXACTLY this schema:

{{
  "queries": [
    {{"query_text": "string", "intent": "one of: {', '.join(sorted(VALID_INTENTS))}"}}
  ]
}}

Return nothing but that JSON object."""

    def build_user_prompt(
        self,
        *,
        business_name: str,
        domain: str,
        industry: str,
        description: str,
        competitors: list[str],
    ) -> str:
        competitor_list = ", ".join(competitors) if competitors else "(none provided)"
        return f"""Business profile:
- Name: {business_name}
- Domain: {domain}
- Industry / category: {industry}
- Description: {description or "(none provided)"}
- Known competitors: {competitor_list}

Generate the discovery query set for this business's competitive space now.
Where natural, reference the named competitors directly in "comparison"
intent questions (e.g. "{business_name} vs {competitors[0] if competitors else '[competitor]'} -- which is better for ...")."""

    def validate(self, parsed) -> bool:
        if not isinstance(parsed, dict):
            return False
        queries = parsed.get("queries")
        if not isinstance(queries, list) or not (1 <= len(queries) <= 40):
            return False
        for item in queries:
            if not isinstance(item, dict):
                return False
            if not isinstance(item.get("query_text"), str) or not item["query_text"].strip():
                return False
            # intent is validated leniently (defaulted downstream if invalid)
            # so a slightly-off intent label doesn't fail the whole batch.
        return True

    @staticmethod
    def fallback_queries(business_name: str, industry: str, competitors: list[str]) -> dict:
        """Deterministic fallback used only if the LLM fails validation twice
        in a row (see BaseAgent.run). Ensures the pipeline still produces a
        usable, non-empty query set rather than aborting the run."""
        primary_competitor = competitors[0] if competitors else "leading alternatives"
        templates = [
            (f"What is the best {industry} tool available today?", "best_of"),
            (f"{business_name} vs {primary_competitor} -- which is better?", "comparison"),
            (f"What is {industry.lower()} and why does it matter?", "definitional"),
            (f"How do I choose a {industry.lower()} solution for my team?", "how_to"),
            (f"What are common problems with {industry.lower()} tools?", "informational"),
        ]
        return {"queries": [{"query_text": t, "intent": i} for t, i in templates]}
