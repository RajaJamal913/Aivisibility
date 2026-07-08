"""
BaseAgent centralises the retry/fallback behaviour that ALL three agents
need when talking to an LLM: request JSON, validate its shape, retry once
with a corrective follow-up prompt if it's malformed, and only then give up
and let the caller apply a deterministic fallback. This is what fulfils the
"pipeline must not crash on malformed LLM output" requirement without
duplicating the same try/except/retry scaffolding three times.

It also handles provider rate limiting (429 / RESOURCE_EXHAUSTED errors,
common on free-tier API keys with low requests-per-minute quotas): rather
than treating a rate limit the same as any other failure, `_call` reads the
provider's own suggested cooldown (e.g. Gemini's `retry_delay`, present
directly on the exception object) and sleeps that long before making one
extra attempt -- so a low-RPM free-tier key still succeeds, just slower,
instead of immediately falling back to templated data on every single call.

Each concrete agent (discovery/scoring/recommendation) subclasses this,
supplies its own system prompt + user prompt template + a `validate()`
method describing what a well-formed response looks like, and implements
its own domain-specific fallback for when the LLM never produces anything
usable after retrying.
"""
from __future__ import annotations

import logging
import re
import time
from abc import ABC, abstractmethod

from app.services.llm_client import LLMClient, LLMResponse

logger = logging.getLogger(__name__)

RETRY_CORRECTION_SUFFIX = (
    "\n\nIMPORTANT: Your previous response could not be parsed as valid JSON "
    "matching the required schema. Respond with ONLY the corrected JSON object "
    "and nothing else -- no markdown fences, no commentary, no explanation."
)

# Fallback wait if a rate-limit error doesn't expose a machine-readable
# retry delay (defensive default; providers that DO tell us -- e.g. Gemini's
# `retry_delay.seconds` -- are honored exactly instead of using this).
DEFAULT_RATE_LIMIT_BACKOFF_SECONDS = 15.0

_RATE_LIMIT_MARKERS = ("resourceexhausted", "ratelimiterror", "429", "quota", "rate limit")


def _is_rate_limit_error(exc: Exception) -> bool:
    haystack = f"{type(exc).__name__} {exc}".lower()
    return any(marker in haystack for marker in _RATE_LIMIT_MARKERS)


def _extract_retry_delay_seconds(exc: Exception) -> float:
    """Best-effort extraction of a provider-suggested cooldown.

    Google's `ResourceExhausted` exposes `exc.retry_delay.seconds` directly.
    OpenAI/xAI/Anthropic rate-limit errors typically don't expose a
    structured field, but often mention the wait in the message text (e.g.
    "Please retry in 32.6s") -- so we fall back to a regex over str(exc)
    before giving up and using the default.
    """
    retry_delay = getattr(exc, "retry_delay", None)
    if retry_delay is not None:
        seconds = getattr(retry_delay, "seconds", None)
        if seconds is not None:
            return float(seconds) + 1.0  # small safety buffer

    match = re.search(r"retry in ([\d.]+)\s*s", str(exc), re.IGNORECASE)
    if match:
        return float(match.group(1)) + 1.0

    return DEFAULT_RATE_LIMIT_BACKOFF_SECONDS


class BaseAgent(ABC):
    name: str = "base_agent"
    max_tokens: int = 2000

    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client

    @abstractmethod
    def system_prompt(self) -> str:
        ...

    @abstractmethod
    def build_user_prompt(self, **kwargs) -> str:
        ...

    @abstractmethod
    def validate(self, parsed) -> bool:
        """Return True if `parsed` matches this agent's expected schema."""

    def run(self, **kwargs) -> tuple[dict | list | None, int]:
        """Executes the LLM call with one retry-on-malformed-JSON attempt.

        Returns (parsed_result_or_None, total_tokens_used). A None result
        means both attempts failed validation; the caller (agent subclass
        or orchestrator) is responsible for applying a deterministic
        fallback so the pipeline continues rather than crashing.
        """
        system_prompt = self.system_prompt()
        user_prompt = self.build_user_prompt(**kwargs)
        total_tokens = 0

        response = self._call(system_prompt, user_prompt)
        total_tokens += response.tokens_used or 0

        if response.parsed is not None and self.validate(response.parsed):
            return response.parsed, total_tokens

        logger.warning(
            "%s: first response failed validation (parsed=%s); retrying with correction.",
            self.name,
            response.parsed is not None,
        )

        retry_response = self._call(system_prompt, user_prompt + RETRY_CORRECTION_SUFFIX)
        total_tokens += retry_response.tokens_used or 0

        if retry_response.parsed is not None and self.validate(retry_response.parsed):
            return retry_response.parsed, total_tokens

        logger.error("%s: retry also failed validation; caller must apply fallback.", self.name)
        return None, total_tokens

    def _call(self, system_prompt: str, user_prompt: str) -> LLMResponse:
        """Makes one LLM call. On a rate-limit error, waits for the
        provider's suggested cooldown and makes exactly one extra attempt
        before giving up -- this is separate from, and happens underneath,
        the JSON-validation retry in `run()` above."""
        try:
            return self.llm_client.complete_json(system_prompt, user_prompt, max_tokens=self.max_tokens)
        except Exception as exc:  # noqa: BLE001 - LLM/network failures must not crash the pipeline
            if _is_rate_limit_error(exc):
                delay = _extract_retry_delay_seconds(exc)
                logger.warning(
                    "%s: rate-limited by provider, waiting %.1fs before one more attempt: %s",
                    self.name,
                    delay,
                    exc,
                )
                time.sleep(delay)
                try:
                    return self.llm_client.complete_json(system_prompt, user_prompt, max_tokens=self.max_tokens)
                except Exception as exc_after_backoff:  # noqa: BLE001
                    logger.error(
                        "%s: LLM call raised %s even after rate-limit backoff: %s",
                        self.name,
                        type(exc_after_backoff).__name__,
                        exc_after_backoff,
                    )
                    return LLMResponse(parsed=None, raw_text="", tokens_used=None, provider=self.llm_client.provider, model=self.llm_client.model)

            logger.error("%s: LLM call raised %s: %s", self.name, type(exc).__name__, exc)
            return LLMResponse(parsed=None, raw_text="", tokens_used=None, provider=self.llm_client.provider, model=self.llm_client.model)
