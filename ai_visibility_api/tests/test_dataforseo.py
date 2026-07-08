"""
Tests for the DataForSEO integration layer, focused on the fallback
contract: any failure mode (no credentials, network error, auth error,
malformed response) must degrade to the deterministic mock provider rather
than raising or blocking the pipeline.
"""
import requests

from app.services.dataforseo import DataForSEOClient


def test_uses_mock_when_not_configured():
    client = DataForSEOClient(login=None, password=None, base_url="https://api.dataforseo.com")
    results = client.get_search_data(["what is seo"])
    assert results[0].provider == "mock"
    assert results[0].estimated_search_volume > 0


def test_uses_mock_when_forced():
    client = DataForSEOClient(login="user", password="pass", base_url="https://api.dataforseo.com", force_mock=True)
    results = client.get_search_data(["what is seo"])
    assert results[0].provider == "mock"


def test_mock_data_is_deterministic_for_same_query():
    client = DataForSEOClient(login=None, password=None, base_url="https://api.dataforseo.com")
    r1 = client.get_search_data(["same query"])[0]
    r2 = client.get_search_data(["same query"])[0]
    assert r1.estimated_search_volume == r2.estimated_search_volume
    assert r1.competitive_difficulty == r2.competitive_difficulty


def test_falls_back_to_mock_on_network_error(monkeypatch):
    client = DataForSEOClient(login="user", password="pass", base_url="https://api.dataforseo.com")

    def raise_connection_error(*args, **kwargs):
        raise requests.ConnectionError("simulated network failure")

    monkeypatch.setattr("app.services.dataforseo.requests.post", raise_connection_error)

    results = client.get_search_data(["what is seo"])
    assert results[0].provider == "mock"


def test_falls_back_to_mock_on_auth_error(monkeypatch):
    client = DataForSEOClient(login="bad", password="creds", base_url="https://api.dataforseo.com")

    class FakeResponse:
        status_code = 401

        def raise_for_status(self):
            raise requests.HTTPError("401 Unauthorized")

    monkeypatch.setattr("app.services.dataforseo.requests.post", lambda *a, **k: FakeResponse())

    results = client.get_search_data(["what is seo"])
    assert results[0].provider == "mock"


def test_falls_back_to_mock_on_exhausted_trial_credit(monkeypatch):
    """DataForSEO returns HTTP 200 with a non-20000 status_code when trial
    credit is exhausted -- this must also trigger the fallback, not just
    raw network/HTTP errors."""
    client = DataForSEOClient(login="user", password="pass", base_url="https://api.dataforseo.com")

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return {"status_code": 40202, "status_message": "Insufficient funds on your balance."}

    monkeypatch.setattr("app.services.dataforseo.requests.post", lambda *a, **k: FakeResponse())

    results = client.get_search_data(["what is seo"])
    assert results[0].provider == "mock"


def test_real_provider_used_on_successful_response(monkeypatch):
    client = DataForSEOClient(login="user", password="pass", base_url="https://api.dataforseo.com")

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return {
                "status_code": 20000,
                "tasks": [
                    {
                        "status_code": 20000,
                        "result": [
                            {"keyword": "what is seo", "search_volume": 1234, "competition_index": 67}
                        ],
                    }
                ],
            }

    monkeypatch.setattr("app.services.dataforseo.requests.post", lambda *a, **k: FakeResponse())

    results = client.get_search_data(["what is seo"])
    assert results[0].provider == "dataforseo"
    assert results[0].estimated_search_volume == 1234
    assert results[0].competitive_difficulty == 67
