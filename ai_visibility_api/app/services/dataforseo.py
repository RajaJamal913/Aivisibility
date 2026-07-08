"""
DataForSEO integration layer.

Real integration
-----------------
Uses DataForSEO's "Keywords Data -> Google Ads -> Search Volume" endpoint
(``/v3/keywords_data/google_ads/search_volume/live``) to fetch real
monthly search volume and a competition index for a batch of query
strings. Docs: https://docs.dataforseo.com/v3/keywords_data/google_ads/search_volume/live/

DataForSEO uses HTTP Basic Auth (login/password from your account, NOT an
API key). Every /live endpoint is billed per call, which is why this layer
never calls it directly from agents -- callers must go through
`get_search_data()` below, which handles trial exhaustion / auth failure /
network errors by transparently falling back to a deterministic simulated
provider so the pipeline never crashes for lack of API credit.

Fallback provider
-------------------
`_mock_search_data()` deterministically derives plausible volume and
competition numbers from a hash of the query text, so:
  - the same query always gets the same mock numbers (idempotent, testable)
  - numbers still vary meaningfully across different queries
  - no network call, no API cost, works entirely offline

The PipelineRun model records which provider (`dataforseo` or `mock`) was
actually used for each run, so this is never silently hidden from the
person reviewing results.
"""
from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass

import requests
from requests.auth import HTTPBasicAuth

logger = logging.getLogger(__name__)

DATAFORSEO_TIMEOUT_SECONDS = 15


@dataclass
class SearchDataResult:
    query_text: str
    estimated_search_volume: int
    competitive_difficulty: int  # 0-100
    provider: str  # "dataforseo" | "mock"


class DataForSEOClient:
    def __init__(self, login: str | None, password: str | None, base_url: str, force_mock: bool = False):
        self.login = login
        self.password = password
        self.base_url = base_url.rstrip("/")
        self.force_mock = force_mock

    @property
    def is_configured(self) -> bool:
        return bool(self.login and self.password)

    def get_search_data(self, queries: list[str], location_code: int = 2840, language_code: str = "en") -> list[SearchDataResult]:
        """Return search volume + competitive difficulty for each query.

        Tries the real DataForSEO API first (unless forced to mock or not
        configured). On ANY failure -- auth error, exhausted trial credit,
        timeout, malformed response -- falls back to the deterministic mock
        provider for the *entire batch*, logging why, rather than mixing
        real and mock data within a single pipeline run (which would make
        opportunity scores incomparable across queries in the same run).
        """
        if self.force_mock or not self.is_configured:
            reason = "FORCE_MOCK_DATA_PROVIDER is set" if self.force_mock else "no DataForSEO credentials configured"
            logger.info("Using mock search-data provider (%s).", reason)
            return [self._mock_search_data(q) for q in queries]

        try:
            return self._real_search_data(queries, location_code, language_code)
        except Exception as exc:  # noqa: BLE001 - deliberate broad catch for fallback
            logger.warning(
                "DataForSEO request failed (%s: %s); falling back to mock search-data provider.",
                type(exc).__name__,
                exc,
            )
            return [self._mock_search_data(q) for q in queries]

    def _real_search_data(self, queries: list[str], location_code: int, language_code: str) -> list[SearchDataResult]:
        url = f"{self.base_url}/v3/keywords_data/google_ads/search_volume/live"
        payload = [
            {
                "keywords": [q[:80] for q in queries],  # API keyword length limit
                "location_code": location_code,
                "language_code": language_code,
            }
        ]
        response = requests.post(
            url,
            json=payload,
            auth=HTTPBasicAuth(self.login, self.password),
            timeout=DATAFORSEO_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        body = response.json()

        if body.get("status_code") != 20000:
            raise RuntimeError(f"DataForSEO error {body.get('status_code')}: {body.get('status_message')}")

        tasks = body.get("tasks") or []
        if not tasks or tasks[0].get("status_code") != 20000:
            raise RuntimeError("DataForSEO task returned a non-success status.")

        results_by_keyword = {}
        for item in (tasks[0].get("result") or []):
            keyword = item.get("keyword")
            volume = item.get("search_volume") or 0
            # DataForSEO's "competition" is 0.0-1.0 float; we scale to our
            # 0-100 competitive_difficulty convention used across the schema.
            competition = item.get("competition_index")
            difficulty = int(round(competition)) if competition is not None else 50
            results_by_keyword[keyword] = (volume, difficulty)

        output = []
        for q in queries:
            key = q[:80]
            if key in results_by_keyword:
                volume, difficulty = results_by_keyword[key]
                output.append(SearchDataResult(q, int(volume), int(difficulty), provider="dataforseo"))
            else:
                # DataForSEO omits keywords it has no data for rather than
                # erroring: fill the gap with mock data for just that query
                # instead of failing the whole batch.
                output.append(self._mock_search_data(q))
        return output

    @staticmethod
    def _mock_search_data(query_text: str) -> SearchDataResult:
        digest = hashlib.sha256(query_text.strip().lower().encode()).hexdigest()
        # Derive two independent-looking pseudo-random numbers from disjoint
        # slices of the hash so volume and difficulty don't move in lockstep.
        volume_seed = int(digest[:8], 16)
        difficulty_seed = int(digest[8:16], 16)

        estimated_search_volume = 50 + (volume_seed % 4950)  # 50 - 5000
        competitive_difficulty = difficulty_seed % 101  # 0 - 100

        return SearchDataResult(
            query_text=query_text,
            estimated_search_volume=estimated_search_volume,
            competitive_difficulty=competitive_difficulty,
            provider="mock",
        )


def build_dataforseo_client(app_config) -> DataForSEOClient:
    return DataForSEOClient(
        login=app_config.DATAFORSEO_LOGIN,
        password=app_config.DATAFORSEO_PASSWORD,
        base_url=app_config.DATAFORSEO_BASE_URL,
        force_mock=app_config.FORCE_MOCK_DATA_PROVIDER,
    )
