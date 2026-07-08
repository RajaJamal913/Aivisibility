"""
Agent 2 -- Visibility Scoring Agent

Responsibility: given ONE discovered query and a target domain, simulate
whether an AI assistant answering that query would surface the target
domain, and at roughly what position among the sources it would cite.
Also judges the same question for each of the target's listed
competitors, in the same call -- this is what backs the real (not
fabricated) "Share of Voice" comparison in the frontend.

Search volume and competitive difficulty are NOT hallucinated by the LLM --
they come from `services/dataforseo.py` (real DataForSEO data, with a
deterministic mock fallback). This agent's LLM call is scoped narrowly to
the sub-problems an LLM is actually well-suited for here: reasoning about
whether a domain would plausibly be cited for a given query given its
description and competitor set, which is not something a data API can
tell us. This keeps the LLM's job small and well-defined, which is also
why this agent is cheap to run per-query and easy to retry/fallback for in
isolation without re-running the whole pipeline (see the /recheck endpoint).
"""
from __future__ import annotations

from app.agents.base import BaseAgent


class VisibilityScoringAgent(BaseAgent):
    name = "visibility_scoring_agent"
    max_tokens = 1024

    def system_prompt(self) -> str:
        return """You are a Visibility Scoring Agent inside an AI-visibility research
platform. Given ONE user query, a target business's profile, and its listed
competitors, you estimate whether the TARGET business's domain -- and
SEPARATELY, each listed competitor's domain -- would plausibly be cited as
a source in an AI assistant's (ChatGPT/Claude/Perplexity-style) generated
answer to that query.

Base your judgment on:
- How directly each business's stated description/industry (or, for
  competitors, their name/domain alone) matches what the query is asking
  about.
- Whether the query explicitly names a specific business (a query naming
  one competitor but not others is strong evidence only that one would be
  cited).
- How likely a generic, well-known incumbent would crowd out a
  narrower/less-established player for this specific query.

Be realistic and skeptical, not optimistic -- most businesses are NOT
visible for most queries in their space. Reserve `true` for cases with a
clear, direct match between the query and that specific business. It's
normal and expected for most or all businesses (including every
competitor) to be judged not-visible for a given query.

Output format -- respond with ONLY a JSON object, no markdown fences, no
commentary, matching EXACTLY this schema:

{
  "domain_visible": true or false,
  "visibility_position": integer from 1-10, or null if domain_visible is false,
  "confidence_reasoning": "one short sentence explaining the judgment",
  "competitor_visibility": {
    "<competitor_domain>": true or false
    // one boolean entry for EVERY competitor domain listed below, exactly as given
  }
}

If no competitors are listed, return "competitor_visibility": {}.
Return nothing but that JSON object."""

    def build_user_prompt(
        self,
        *,
        query_text: str,
        business_name: str,
        domain: str,
        industry: str,
        description: str,
        competitors: list[str],
    ) -> str:
        return f"""Query being asked to an AI assistant: "{query_text}"

Target business:
- Name: {business_name}
- Domain: {domain}
- Industry: {industry}
- Description: {description or "(none provided)"}

Competitor domains to also judge (one entry each in competitor_visibility,
using these exact strings as keys): {", ".join(competitors) if competitors else "(none listed)"}

Would the target business's domain plausibly be cited in an AI assistant's
answer to that query? And separately, would each listed competitor's
domain be cited? Respond with the JSON schema now."""

    def validate(self, parsed) -> bool:
        if not isinstance(parsed, dict):
            return False
        if not isinstance(parsed.get("domain_visible"), bool):
            return False
        position = parsed.get("visibility_position")
        if position is not None and not isinstance(position, int):
            return False
        competitor_visibility = parsed.get("competitor_visibility")
        if competitor_visibility is not None:
            if not isinstance(competitor_visibility, dict):
                return False
            if not all(isinstance(v, bool) for v in competitor_visibility.values()):
                return False
        return True

    @staticmethod
    def fallback_visibility(competitors: list[str] | None = None) -> dict:
        """Deterministic fallback if the LLM fails validation twice: assume
        NOT visible (the conservative, worst-case default) for the target
        AND every competitor, rather than guessing optimistically, and flag
        it via confidence_reasoning so it's distinguishable from a real
        model judgment in logs/debugging."""
        return {
            "domain_visible": False,
            "visibility_position": None,
            "confidence_reasoning": "fallback: LLM scoring unavailable, defaulted to not-visible",
            "competitor_visibility": {c: False for c in (competitors or [])},
        }
