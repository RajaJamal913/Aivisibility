"""
Thin, provider-agnostic wrapper around Anthropic and OpenAI chat completions.

Each agent calls `LLMClient.complete_json(system_prompt, user_prompt, ...)`
and gets back a tuple of (parsed_json_or_None, raw_text, tokens_used).
Parsing failures are NOT raised here -- they're returned as `None` for the
parsed value so the calling agent can apply its own fallback/retry logic
(see agents/base.py) rather than this shared client making that policy
decision on every agent's behalf.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)

_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


@dataclass
class LLMResponse:
    parsed: dict | list | None
    raw_text: str
    tokens_used: int | None
    provider: str
    model: str


def _extract_json_text(raw_text: str) -> str:
    """LLMs sometimes wrap JSON in markdown fences or add a sentence before
    it despite instructions not to. Strip fences first, then fall back to
    slicing between the first '{'/'[' and the matching last '}'/']'."""
    fenced = _JSON_FENCE_RE.search(raw_text)
    if fenced:
        return fenced.group(1).strip()

    text = raw_text.strip()
    first_brace = min(
        (i for i in (text.find("{"), text.find("[")) if i != -1),
        default=-1,
    )
    if first_brace == -1:
        return text

    last_brace = max(text.rfind("}"), text.rfind("]"))
    if last_brace == -1 or last_brace < first_brace:
        return text

    return text[first_brace : last_brace + 1]


class LLMClient:
    def __init__(
        self,
        provider: str,
        model: str,
        anthropic_api_key: str | None,
        openai_api_key: str | None,
        xai_api_key: str | None = None,
        gemini_api_key: str | None = None,
    ):
        self.provider = provider.lower()
        self.model = model
        self.anthropic_api_key = anthropic_api_key
        self.openai_api_key = openai_api_key
        self.xai_api_key = xai_api_key
        self.gemini_api_key = gemini_api_key

    def complete_json(self, system_prompt: str, user_prompt: str, max_tokens: int = 2000) -> LLMResponse:
        if self.provider == "anthropic":
            return self._complete_anthropic(system_prompt, user_prompt, max_tokens)
        elif self.provider == "openai":
            return self._complete_openai(system_prompt, user_prompt, max_tokens)
        elif self.provider in ("xai", "grok"):
            return self._complete_xai(system_prompt, user_prompt, max_tokens)
        elif self.provider in ("gemini", "google"):
            return self._complete_gemini(system_prompt, user_prompt, max_tokens)
        raise ValueError(f"Unsupported LLM provider: {self.provider}")

    def _complete_anthropic(self, system_prompt: str, user_prompt: str, max_tokens: int) -> LLMResponse:
        import anthropic

        client = anthropic.Anthropic(api_key=self.anthropic_api_key)
        message = client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        raw_text = "".join(block.text for block in message.content if block.type == "text")
        tokens_used = None
        if message.usage:
            tokens_used = (message.usage.input_tokens or 0) + (message.usage.output_tokens or 0)

        parsed = self._safe_parse(raw_text)
        return LLMResponse(parsed, raw_text, tokens_used, "anthropic", self.model)

    def _complete_openai(self, system_prompt: str, user_prompt: str, max_tokens: int) -> LLMResponse:
        from openai import OpenAI

        client = OpenAI(api_key=self.openai_api_key)
        response = client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        raw_text = response.choices[0].message.content or ""
        tokens_used = response.usage.total_tokens if response.usage else None

        parsed = self._safe_parse(raw_text)
        return LLMResponse(parsed, raw_text, tokens_used, "openai", self.model)

    def _complete_xai(self, system_prompt: str, user_prompt: str, max_tokens: int) -> LLMResponse:
        """xAI's Grok API is intentionally OpenAI-SDK-compatible (same request/
        response shape) -- so this reuses the `openai` package, just pointed at
        xAI's base_url with an xAI API key instead of an OpenAI one. No new
        dependency needed. See https://docs.x.ai/docs/overview for the
        compatibility statement."""
        from openai import OpenAI

        client = OpenAI(api_key=self.xai_api_key, base_url="https://api.x.ai/v1")
        response = client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        raw_text = response.choices[0].message.content or ""
        tokens_used = response.usage.total_tokens if response.usage else None

        parsed = self._safe_parse(raw_text)
        return LLMResponse(parsed, raw_text, tokens_used, "xai", self.model)

    def _complete_gemini(self, system_prompt: str, user_prompt: str, max_tokens: int) -> LLMResponse:
        import google.generativeai as genai

        genai.configure(api_key=self.gemini_api_key)
        model = genai.GenerativeModel(model_name=self.model, system_instruction=system_prompt)
        response = model.generate_content(
            user_prompt,
            generation_config={"max_output_tokens": max_tokens},
        )
        raw_text = response.text or ""
        tokens_used = None
        if getattr(response, "usage_metadata", None):
            tokens_used = response.usage_metadata.total_token_count

        parsed = self._safe_parse(raw_text)
        return LLMResponse(parsed, raw_text, tokens_used, "gemini", self.model)

    @staticmethod
    def _safe_parse(raw_text: str):
        try:
            return json.loads(_extract_json_text(raw_text))
        except (json.JSONDecodeError, ValueError) as exc:
            logger.warning("Failed to parse LLM response as JSON: %s", exc)
            return None


def build_llm_client(provider: str, model: str, app_config) -> LLMClient:
    return LLMClient(
        provider=provider,
        model=model,
        anthropic_api_key=app_config.ANTHROPIC_API_KEY,
        openai_api_key=app_config.OPENAI_API_KEY,
        xai_api_key=app_config.XAI_API_KEY,
        gemini_api_key=app_config.GEMINI_API_KEY,
    )
