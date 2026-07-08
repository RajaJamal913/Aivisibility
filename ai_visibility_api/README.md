# AI Visibility Intelligence API

A Flask REST API that runs a three-agent AI pipeline to discover, score,
and generate content recommendations for a business's visibility in
AI-generated answers (ChatGPT, Claude, Perplexity, etc.).

Built to the spec in `Full Stack Developer Technical Assessment` — Task 1
(Backend).

---

## Quick Start

### Option A — Docker (recommended, one command)

```bash
cp .env.example .env
# Edit .env: add ANTHROPIC_API_KEY (or OPENAI_API_KEY) at minimum.
# DataForSEO credentials are optional -- see "Data Provider" below.
docker-compose up --build
```

The API is live at `http://localhost:5000`. Migrations run automatically
on container start.

### Option B — Local script

```bash
./setup.sh
```

This creates a venv, installs dependencies, copies `.env.example` → `.env`,
runs migrations, and starts the dev server. Edit `.env` with your API keys
before triggering a pipeline run (profile creation works with no keys at
all).

### Option C — Manual

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then edit it
export FLASK_APP=wsgi.py
flask db upgrade   # applies the migrations already committed in migrations/
flask run
```

### Verify it's running

```bash
curl http://localhost:5000/api/v1/health
# {"status": "ok"}
```

### Try the full flow

```bash
# 1. Register a profile
curl -X POST http://localhost:5000/api/v1/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Frase",
    "domain": "frase.io",
    "industry": "SEO Content Tools",
    "description": "AI-powered content briefs and SEO research",
    "competitors": ["surferseo.com", "marketmuse.com", "clearscope.io"]
  }'
# -> copy the "profile_uuid" from the response

# 2. Trigger the pipeline (takes ~10-30s depending on provider/model)
curl -X POST http://localhost:5000/api/v1/profiles/<profile_uuid>/run

# 3. Inspect results
curl "http://localhost:5000/api/v1/profiles/<profile_uuid>/queries?min_score=0.5"
curl http://localhost:5000/api/v1/profiles/<profile_uuid>/recommendations
```

### Run the test suite

```bash
source venv/bin/activate
pytest tests/ -v
```

All agent logic, the opportunity-score formula, and the DataForSEO
fallback contract are covered with mocked LLM/HTTP calls — no API keys or
network access required to run tests (33 tests, all offline).

---

## Architecture

```
app/
├── __init__.py           # create_app() factory
├── config.py              # env-var-driven config, incl. per-agent provider/model
├── extensions.py          # db, migrate, limiter singletons
├── errors.py               # ApiError hierarchy + consistent error-response handlers
├── schemas.py              # marshmallow request validation
├── models/                 # SQLAlchemy models (see "Data Model" below)
├── agents/
│   ├── base.py             # BaseAgent: shared retry-on-malformed-JSON logic
│   ├── discovery.py        # Agent 1
│   ├── scoring.py          # Agent 2
│   └── recommendation.py   # Agent 3
├── services/
│   ├── llm_client.py        # provider-agnostic Anthropic/OpenAI wrapper
│   ├── dataforseo.py         # real DataForSEO client + deterministic mock fallback
│   ├── pipeline.py            # orchestrator: sequences agents, isolates failures
│   └── factory.py              # builds agents/orchestrator from Flask config
└── api/
    ├── profiles.py           # POST/GET profiles, POST .../run
    └── queries.py             # GET queries/recommendations, POST recheck
```

**App factory + blueprints.** `create_app()` takes a config class (default
`Config`, or `TestConfig` for tests), so the whole app can be instantiated
fresh with an in-memory SQLite DB per test with zero shared state.

**Why agents are plain classes, not a framework.** Each agent
(`QueryDiscoveryAgent`, `VisibilityScoringAgent`,
`ContentRecommendationAgent`) subclasses `BaseAgent`, which owns exactly
one piece of shared behavior: call the LLM, validate the JSON shape, retry
once with a corrective prompt if invalid, and return `None` if it fails
twice. Nothing more. I deliberately avoided reaching for a heavier
agent/orchestration library (LangChain, CrewAI, etc.) — three
independently-testable classes and one orchestrator function fully cover
the spec's requirements, and a framework would mostly add indirection
without buying anything not already needed here. Each agent is
independently constructible and testable with a stubbed LLM client (see
`tests/test_agents.py`), and can even run on a different model/provider
from the other two (configured per-agent in `.env`).

**Orchestrator failure isolation.** `PipelineOrchestrator.run()`:
1. Runs Agent 1 once. If it fails validation twice, a deterministic
   template-based fallback query set is used instead of aborting.
2. Fetches search volume/difficulty for *all* discovered queries in one
   batched DataForSEO call (see below).
3. Runs Agent 2 **once per query**, in a loop. If a single query's scoring
   fails validation twice, that query is still persisted — with
   `scoring_error` set and a conservative "not visible" fallback score —
   and the loop moves on to the next query. One bad query never aborts the
   run.
4. Runs Agent 3 once, over the top gap queries. If it fails validation
   twice, a deterministic per-query fallback recommendation is generated
   instead.
5. The `PipelineRun` row is updated incrementally (not just at the end),
   so even a hard crash partway through (caught by the orchestrator's
   top-level `except`) leaves a `status="failed"` run with whatever
   partial data was already committed, plus `error_message`.

---

## AI Provider Choice

**Configured to use Anthropic (Claude) by default**, with per-agent
provider/model overrides in `.env` (`DISCOVERY_AGENT_PROVIDER`,
`SCORING_AGENT_PROVIDER`, `RECOMMENDATION_AGENT_PROVIDER`, plus matching
`_MODEL` vars). OpenAI is fully supported as a drop-in alternative — set
any agent's provider to `openai` and its model to e.g. `gpt-4o`.

Reasoning for defaulting all three agents to the same provider (rather
than deliberately mixing): all three tasks here (structured JSON
generation from a well-specified schema, short-form classification
judgments) are well within a single strong model's capabilities, and using
one provider throughout keeps latency, cost, and error-handling paths
uniform across a run. The main argument *for* mixing would be cost
optimization — Agent 2 runs once per query (10-20x per pipeline run) and
only needs a small `{domain_visible, position}` judgment, so it's the best
candidate to point at a cheaper/faster model (e.g. Haiku-class or
GPT-4o-mini) if this were running at real scale. The per-agent config
already supports that; the default isn't set that way because for an
assessment-scale pipeline (10-20 queries) the cost difference is
negligible and keeping the default config uniform is easier to reason
about.

---

## Data Model

| Model | Notes |
|---|---|
| `BusinessProfile` | `competitors` stored as JSON list, not a separate table — see rationale in `models/profile.py` docstring: no independent attributes/relationships on competitors justify normalizing them out. |
| `PipelineRun` | Tracks per-run status, counts, tokens, **and `data_provider_used`** (`dataforseo`, `mock`, or both if DataForSEO covered some queries and mock filled gaps) so it's always visible which data source backed a given run's scores. |
| `DiscoveredQuery` | Includes `query_intent` (set by Agent 1, consumed by the scoring formula) and `scoring_error` (non-null only when Agent 2 fell back for that specific query — see failure isolation above). Also persists `confidence_reasoning` — Agent 2's one-sentence judgment for why it scored visibility the way it did. This was previously computed by the LLM and discarded after validation; it's now stored and returned via the API (added in migration `ed1e9a9f6cfb`) since it's real model output, not something worth throwing away, and the frontend surfaces it as the explanation behind each visibility call. Also persists `competitor_visibility` (a `{competitor_domain: bool}` map) and `scoring_llm_provider`/`scoring_llm_model` (added in migration `6d93a4ea9f49`) — see below. |

### Share of Voice: real "Your Brand vs. Competitors" data

Agent 2 originally only judged the target business's own visibility for each query. It's been extended to judge every listed competitor's visibility for that same query, in the same LLM call (see the updated prompt in `app/agents/scoring.py`) — this was a deliberate choice over adding a second agent or a second API call: the competitor set is small and stable per-profile, so it's cheap to ask for as part of the same judgment call, and asking all of them together (rather than in separate calls) means every entity is judged against the identical query context in one pass.

That per-query judgment is aggregated into real percentages by `BusinessProfile.share_of_voice()` and served at:

```
GET /api/v1/profiles/<uuid>/share-of-voice
→ {"entities": [{"name": "...", "is_you": true|false, "visible_count": N, "total_queries": N, "share_pct": 0-100 or null}, ...]}
```

This isn't part of Task 2's original endpoint list — it was added specifically so the frontend's "Share of Voice by Competitor" chart could show genuine per-competitor numbers instead of relabeling an unrelated metric under that title, which is what it was doing before. A competitor showing 0% is a real "Agent 2 never judged them visible for any of this profile's queries," not a placeholder.
| `ContentRecommendation` | `target_keywords` stored as JSON list. |

All primary keys are UUID strings (not autoincrement ints) since they're
exposed directly in the API as opaque identifiers. Foreign keys use
`profile_uuid`/`run_uuid`/`query_uuid` consistently. Migrations are managed
via Flask-Migrate/Alembic (`migrations/`).

---

## Opportunity Score Formula

Full reasoning and weight justification lives as a module docstring in
`app/utils/scoring.py` (recommend reading it directly) — summary:

```
opportunity_score = 0.35 * volume_score        # log-scaled, since volume is heavily right-skewed
                   + 0.25 * difficulty_score    # 1 - (difficulty / 100)
                   + 0.25 * visibility_gap_score # 1.0 if not visible, 0.5 if unknown, 0.15 if strongly visible
                   + 0.15 * intent_score        # comparison/best_of > how_to/informational > definitional
```

Each sub-score is independently normalized to `[0, 1]` *before* weighting,
so raw volume (which can span 10 → 100,000+) doesn't dominate the sum by
scale alone. The formula is covered by `tests/test_scoring_formula.py`,
which asserts ordering properties (e.g. "not visible always scores higher
than visible, all else equal") rather than exact values, since the exact
weights are a judgment call, not a provably-correct constant.

---

## Data Provider: DataForSEO with Automatic Fallback

`app/services/dataforseo.py` implements the **real** DataForSEO
`keywords_data/google_ads/search_volume/live` endpoint (HTTP Basic Auth,
one batched call per pipeline run for all discovered queries).

Because DataForSEO is billed per call and this environment doesn't have
paid trial credit loaded, the client **automatically and transparently
falls back** to a deterministic mock provider whenever the real call:
- isn't configured (no `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD` in `.env`),
- times out or hits a network error,
- returns an auth failure,
- returns a non-`20000` status code (this is exactly the shape DataForSEO
  uses to report exhausted trial credit — `40202 Insufficient funds`),
- or returns a malformed/unexpected response body.

The mock provider (`DataForSEOClient._mock_search_data`) derives volume
and difficulty deterministically from a SHA-256 hash of the query text —
same query always gets the same numbers, numbers vary meaningfully across
different queries, zero network calls, fully offline-testable. This is
**not random data**: it's a stand-in with the same interface contract as
the real API, swappable with zero code changes elsewhere once real
credentials/credit are available. You can force it on unconditionally with
`FORCE_MOCK_DATA_PROVIDER=true` in `.env` (useful for local dev/CI so you
never burn trial credits by accident).

Every `PipelineRun` records `data_provider_used` so it's never silently
ambiguous which one backed a given run's numbers. This whole contract
(mock-on-every-failure-mode, determinism, real-provider-success-path) is
covered in `tests/test_dataforseo.py`.

**To actually exercise the real integration:** sign up for a DataForSEO
free trial, put the login/password in `.env`, and trigger a pipeline run —
no code changes needed.

---

## Prompt Engineering Notes

Each agent's full system prompt lives in its module (`agents/discovery.py`,
`agents/scoring.py`, `agents/recommendation.py`) rather than a shared
prompts file, since each prompt is tightly coupled to that agent's specific
output schema and validation logic — reading the prompt next to its
`validate()` method makes it easy to confirm they agree.

Common structure across all three:
- Explicit persona + scope boundary (what the agent should/shouldn't do).
- The exact JSON schema, inlined into the prompt text (not just described
  in prose) so the model has a literal template to match.
- An explicit instruction against markdown fences / commentary, since
  models frequently wrap JSON in ` ```json ` blocks despite being told not
  to — `services/llm_client.py`'s `_extract_json_text()` strips fences
  defensively anyway, as a second line of defense.
- A one-shot retry with an appended correction instruction
  (`BaseAgent.RETRY_CORRECTION_SUFFIX`) if the first response fails
  validation, before falling back to deterministic template data.

---

## API Reference

All endpoints return JSON. All errors follow:
```json
{"error": {"code": "SOME_CODE", "message": "...", "details": {...}}}
```

| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/health` | Liveness check |
| POST | `/api/v1/profiles` | Create a business profile |
| GET | `/api/v1/profiles/<uuid>` | Profile + summary stats |
| POST | `/api/v1/profiles/<uuid>/run` | Trigger the 3-agent pipeline (rate-limited: 5/min) |
| GET | `/api/v1/profiles/<uuid>/queries` | `?min_score=`, `?status=visible\|not_visible\|unknown`, `?page=`, `?per_page=` |
| GET | `/api/v1/profiles/<uuid>/recommendations` | Content recommendations |
| POST | `/api/v1/queries/<uuid>/recheck` | Re-run Agent 2 on a single query |

---

## Tradeoffs & What I'd Do Differently at Larger Scale

- **Synchronous pipeline execution.** Per the spec, async/Celery wasn't
  required. A 10-20 query run with sequential per-query Agent 2 calls
  takes roughly 10-30s, which is within the spec's stated tolerance but
  would need to move to a background task queue with a polling endpoint
  (`GET /profiles/<uuid>/runs/<run_uuid>/status`) at real scale, since a
  synchronous HTTP request holding open for 30s doesn't scale past a
  handful of concurrent users.
- **Agent 2 runs sequentially per query, not in parallel.** This was a
  deliberate simplicity/robustness tradeoff for the assessment — parallel
  execution (e.g. `concurrent.futures.ThreadPoolExecutor`) would cut wall
  time roughly 10x but adds complexity to the partial-failure-isolation
  logic (need thread-safe error collection) that felt like the wrong thing
  to optimize for at this scope.
- **SQLite by default in Docker Compose**, with a commented-out Postgres
  service in `docker-compose.yml` ready to enable. SQLite keeps
  `docker-compose up` a true single command with no separate DB container
  to wait on; Postgres is the obvious next step for any multi-instance
  deployment (SQLite's file-level locking doesn't handle concurrent writers
  well).
- **Rate limiting uses in-memory storage** (`flask-limiter` with
  `memory://`). Fine for a single-process deployment; would need Redis
  as the storage backend behind multiple gunicorn workers/instances so
  limits are shared rather than per-process.
- **No auth layer**, per the spec ("Authentication is out of scope").
- **`ContentRecommendation.target_keywords` and `BusinessProfile.competitors`
  are stored as JSON columns**, not normalized child tables. Both are
  small, unordered string lists with no independent attributes or queries
  against individual elements — normalizing them would add joins for zero
  benefit at this scale. If recommendations needed keyword-level tracking
  (e.g. "show me every recommendation touching keyword X" as an indexed
  query), that would be the trigger to split it out.

---

## Environment Variables

See `.env.example` for the full list with inline comments. Minimum to get
profile CRUD working: nothing (SQLite + mock data work out of the box).
Minimum to run the actual AI pipeline: one LLM provider key
(`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`) matching whatever
`*_AGENT_PROVIDER` values you've configured.
