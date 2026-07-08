def test_create_profile_success(client):
    r = client.post(
        "/api/v1/profiles",
        json={
            "name": "Frase",
            "domain": "frase.io",
            "industry": "SEO Tools",
            "description": "desc",
            "competitors": ["surferseo.com"],
        },
    )
    assert r.status_code == 201
    body = r.get_json()
    assert body["name"] == "Frase"
    assert body["status"] == "created"
    assert "profile_uuid" in body


def test_create_profile_missing_required_fields_returns_422_with_consistent_error_shape(client):
    r = client.post("/api/v1/profiles", json={"name": "Frase"})
    assert r.status_code == 422
    body = r.get_json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert "domain" in body["error"]["details"]
    assert "industry" in body["error"]["details"]


def test_get_profile_not_found_returns_404_with_consistent_error_shape(client):
    r = client.get("/api/v1/profiles/nonexistent-uuid")
    assert r.status_code == 404
    body = r.get_json()
    assert body["error"]["code"] == "NOT_FOUND"


def test_get_profile_includes_stats(client):
    create = client.post(
        "/api/v1/profiles",
        json={"name": "Frase", "domain": "frase.io", "industry": "SEO Tools"},
    )
    profile_uuid = create.get_json()["profile_uuid"]

    r = client.get(f"/api/v1/profiles/{profile_uuid}")
    assert r.status_code == 200
    body = r.get_json()
    assert body["stats"]["total_queries_discovered"] == 0
    assert body["stats"]["avg_opportunity_score"] is None


def test_list_queries_for_nonexistent_profile_returns_404(client):
    r = client.get("/api/v1/profiles/nonexistent/queries")
    assert r.status_code == 404


def test_list_queries_invalid_status_filter_returns_422(client):
    create = client.post(
        "/api/v1/profiles",
        json={"name": "Frase", "domain": "frase.io", "industry": "SEO Tools"},
    )
    profile_uuid = create.get_json()["profile_uuid"]

    r = client.get(f"/api/v1/profiles/{profile_uuid}/queries?status=bogus")
    assert r.status_code == 422
    assert r.get_json()["error"]["code"] == "VALIDATION_ERROR"


def test_recheck_nonexistent_query_returns_404(client):
    r = client.post("/api/v1/queries/nonexistent-uuid/recheck")
    assert r.status_code == 404


def test_health_check(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.get_json() == {"status": "ok"}


def test_list_profiles_empty(client):
    r = client.get("/api/v1/profiles")
    assert r.status_code == 200
    body = r.get_json()
    assert body["profiles"] == []
    assert body["pagination"]["total_items"] == 0


def test_list_profiles_returns_created_profiles_with_stats(client):
    client.post("/api/v1/profiles", json={"name": "A", "domain": "a.com", "industry": "SaaS"})
    client.post("/api/v1/profiles", json={"name": "B", "domain": "b.com", "industry": "SaaS"})

    r = client.get("/api/v1/profiles")
    assert r.status_code == 200
    body = r.get_json()
    assert len(body["profiles"]) == 2
    assert "stats" in body["profiles"][0]
    # most recently created first
    assert body["profiles"][0]["name"] == "B"


def test_list_profiles_invalid_pagination_returns_422(client):
    r = client.get("/api/v1/profiles?per_page=500")
    assert r.status_code == 422
    assert r.get_json()["error"]["code"] == "VALIDATION_ERROR"


def test_cors_headers_present_for_configured_origin(client):
    r = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    assert r.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"


def test_list_pipeline_runs_for_nonexistent_profile_returns_404(client):
    r = client.get("/api/v1/profiles/nonexistent/runs")
    assert r.status_code == 404


def test_list_pipeline_runs_empty_before_any_run(client):
    create = client.post("/api/v1/profiles", json={"name": "A", "domain": "a.com", "industry": "SaaS"})
    profile_uuid = create.get_json()["profile_uuid"]

    r = client.get(f"/api/v1/profiles/{profile_uuid}/runs")
    assert r.status_code == 200
    assert r.get_json()["runs"] == []
