# AI Visibility Dashboard — Frontend

React + TypeScript dashboard for the AI Visibility Intelligence API (Task 1 backend).

---

## Quick Start

```bash
npm install
cp .env.example .env   # edit VITE_API_BASE_URL if your backend isn't on :5000
npm run dev
```

Opens at `http://localhost:5173`. Requires the Task 1 Flask backend running (default `http://localhost:5000`) with CORS configured for this origin — see the backend README's `CORS_ORIGINS` setting.

```bash
npm run build     # production build (tsc -b && vite build)
npm run lint      # oxlint
npm run preview   # serve the production build locally
```

---

## Framework & Tooling Choices

- **React 18 + TypeScript**, functional components + hooks throughout, per the spec.
- **Vite**, not Create React App. CRA is effectively unmaintained; Vite is the current standard for new React projects. One consequence: Vite requires environment variables to be prefixed `VITE_` (not `REACT_APP_`) to be exposed to client code. This project uses `VITE_API_BASE_URL` — functionally identical to the spec's `REACT_APP_API_BASE_URL` convention, just Vite's required naming. Noted here since the spec's example used the CRA prefix.
- **Tailwind CSS** for styling — no separate component library (no MUI/Ant/shadcn). A small set of hand-built primitives (`Button`, `Badge`, `Card`, `EmptyState`, `ErrorState`, `Skeleton`, `TagInput`) covers everything this dashboard needs without pulling in a large dependency whose defaults would then need overriding to match the design.
- **Recharts** for the opportunity scatter chart (see below).
- **react-router-dom** for routing.
- **axios** for HTTP, wrapped entirely inside `src/services/api.ts` — no component ever imports axios directly.
- **lucide-react** for icons.

---

## Design Direction

This is a data-tool, not a marketing page, so the design goal was "clean and legible under real data density" rather than a hero-driven layout. A few deliberate choices:

- **Signal bars.** The recurring visual motif (see `components/SignalBars`) renders visibility status as signal-strength bars — the same shape as a phone's reception indicator. It's used in the queries table and profile header. This isn't decorative: bar count and color map directly to `visibility_status` and `visibility_position`, so it's a real information encoding of the exact thing this product measures (how strongly a business "shows up"), not a generic badge.
- **Typography pairing:** Space Grotesk for headings, Inter for body/UI text, IBM Plex Mono for all numeric data (scores, volumes, token counts) — mono digits make tables of numbers easier to scan and compare at a glance, which matters more here than in prose-heavy UI.
- **Color:** a violet `signal` primary (matched to the reference design's brand accent), teal for "visible," amber for "opportunity," red for "not visible" — chosen so status colors stay distinguishable from the primary action color at a glance. Every component references the `signal`/`sweep`/`positive`/`opportunity`/`danger` token names rather than raw hex, so this was a one-file change in `tailwind.config.js` with no component edits needed.
- **Density:** cards, table rows, and KPI stats use tighter padding (`p-4`, `py-2.5`) and a 16px corner radius to match the reference's compact, data-dense feel rather than a marketing-page's generous whitespace. Profile-level stats (queries, avg. opportunity, runs, recommendations) render as small bordered icon-cards — the same pattern as the reference's summary metric cards — instead of bare label/value text.
- **Dark mode** (bonus item) via a `class`-strategy Tailwind config and a small `ThemeContext`, persisted to `localStorage`, defaulting to the OS preference on first load.

### Matching the reference Figma layout (Home + Profile Detail)

The reference mock ("AI Search Visibility" — metrics strip, "Recent Mentions" table, "AI Visibility Score" card, "Share of Voice by Competitor" chart) describes a single-business view, not the multi-tenant "list of all profiles" screen Task 2 also requires. Both are real, separate screens in this app:

- **Home (`/`)** — rebuilt to match the reference layout and copy as closely as possible for a *selected* business profile (see `ProfileSwitcher`, labeled "AI Engine" to match the reference exactly even though it switches profiles, not engines — flagged in a code comment).
- **All Profiles (`/profiles`)** — the required "list of all registered business profiles" screen, since the reference mock has no way to represent a list at all.

Per explicit product decision, Home matches the reference **column-for-column and title-for-title**, not just visually:

| Reference element | What's real | What's placeholder |
| --- | --- | --- |
| Total Mentions / AI Search Volume / Queries Discovered | All three — from `estimated_search_volume` and `visibility_status` | — |
| Recent Mentions table: Mentioned, AI Search Vol, Last Checked | Real (`visibility_status`, `estimated_search_volume`, `last_scored_at`) | — |
| Recent Mentions table: Snippet | **Real** — Agent 2's `confidence_reasoning` (see below) | — |
| Recent Mentions table: Platform | **Real** — the LLM that actually scored that query (`scoring_llm_model`), not a per-query "AI engine" concept the pipeline doesn't have | — |
| Recent Mentions table: Sources, SOV, Location | — | No backing field in the API; renders `—` rather than invented values |
| "Top Brand Entities" panel | Real — the profile's `competitors` list | — |
| "Top Source Domains" panel | — | No source/citation tracking in this API; shown with an honest "not tracked" note, not fake domains |
| "AI Visibility Score" card title | Title matches exactly | Content is our real average opportunity score + top queries, not a literal AI-generated visibility % (we don't have one) |
| "Share of Voice by Competitor" chart | **Real** — see below | — |

**Backend changes made alongside this** (see `ai_visibility_api`'s README for full detail):

1. Agent 2's `confidence_reasoning` (already generated per query, previously discarded after validation) is now persisted and returned, so the Snippet column shows a real model judgment instead of a placeholder.
2. Each query's `scoring_llm_provider`/`scoring_llm_model` (the real LLM config that scored it) is now persisted, backing the Platform column.
3. Agent 2 now also judges every listed competitor's visibility for the same query (`competitor_visibility`), aggregated into a real per-entity percentage via `GET /profiles/<uuid>/share-of-voice`. The Share of Voice chart (`ShareOfVoiceChart`) consumes this directly — purple bar for "You," orange for competitors, real percentages, not a relabeled unrelated metric like the previous iteration.

The search box on Home filters client-side over whatever page is already loaded (the query endpoint only supports `page`/`per_page`/`min_score`/`status`, not free-text search) — called out in code comments rather than silently pretending it's server-side.

---

## Component Architecture

```
src/
├── components/
│   ├── layout/          AppShell, Sidebar, Topbar
│   ├── ui/               Button, Badge, Card, EmptyState, ErrorState, Skeleton, TagInput,
│   │                      MetricsBar, SearchInput, Pagination
│   ├── SignalBars/        the visibility-strength indicator (signature element)
│   ├── ProfileTable/       searchable/paginated profile list (Dashboard)
│   ├── QueryTable/          table + filter bar for the Queries tab
│   ├── OpportunityChart/     volume-vs-difficulty scatter (the required data viz)
│   ├── OpportunityOverview/   avg-score + top-queries summary card
│   ├── VisibilityBreakdown/    visible/not-visible/unknown horizontal-bar summary
│   ├── RecommendationCard/    single recommendation card
│   └── PipelineStatus/         run button + live client-side progress
├── pages/
│   ├── Dashboard.tsx
│   ├── CreateProfile.tsx
│   ├── ProfileDetail.tsx        hosts the three tabs below
│   └── tabs/
│       ├── QueriesTab.tsx
│       ├── RecommendationsTab.tsx
│       └── PipelineRunsTab.tsx
├── services/api.ts        the ONLY file that talks to the backend
├── hooks/                  useProfile, useProfiles, useQueries, usePipeline, usePipelineRuns
├── context/ThemeContext.tsx
└── types/index.ts           TypeScript interfaces mirroring the Flask API's JSON exactly
```

Queries/Recommendations/Pipeline Runs are implemented as **tabs within Profile Detail** rather than separate top-level routes, since the spec's own suggested folder structure lists them as sibling pages but every one of them is meaningless without a profile in context — tabs keep the profile's identity and pipeline-trigger button visible while switching between them, rather than re-fetching and re-rendering the whole profile header on every navigation.

---

## API Integration

All backend calls live in `src/services/api.ts`. Every function returns a typed Promise and throws a normalized `ApiError` (`{ message, code, details }`) on failure — components never see raw axios errors or have to branch on network-vs-4xx-vs-5xx, they just render `error.message` and offer a retry.

Endpoints integrated (all six required, plus two backend additions — see note below):

| Method | Path | Used in |
|---|---|---|
| POST | `/api/v1/profiles` | Create Profile page |
| GET | `/api/v1/profiles` | Dashboard *(see note)* |
| GET | `/api/v1/profiles/{uuid}` | Profile Detail |
| POST | `/api/v1/profiles/{uuid}/run` | Pipeline trigger |
| GET | `/api/v1/profiles/{uuid}/queries` | Queries tab |
| GET | `/api/v1/profiles/{uuid}/recommendations` | Recommendations tab |
| POST | `/api/v1/queries/{uuid}/recheck` | Recheck button per row |
| GET | `/api/v1/profiles/{uuid}/runs` | Pipeline Run History tab *(see note)* |

**Note on the two extra endpoints:** Task 1's original spec only defined `POST /profiles` and `GET /profiles/{uuid}` (single) — there was no way to list *all* profiles for the Dashboard, and no way to list *past* pipeline runs for the History tab (only a single run's result, returned inline from the `/run` call). Both are genuinely required by Task 2's screens, so they were added to the Task 1 backend (`GET /api/v1/profiles` and `GET /api/v1/profiles/{uuid}/runs`) rather than faking the data client-side or silently dropping those screens' functionality.

---

## Pipeline Status: Honest Note on "Real-Time Feedback"

The spec asks for "real-time status feedback (polling or WebSocket)" on the pipeline trigger. The Task 1 backend's `POST /profiles/{uuid}/run` is **synchronous** — it runs all three agents in-process and returns one final response with no job-status endpoint to poll and no WebSocket channel.

Rather than silently ignoring this requirement or inventing a fake polling loop against an endpoint that doesn't exist, `usePipeline` (see `src/hooks/usePipeline.ts`) shows genuine elapsed time plus a staged message ("Discovering queries…" → "Scoring visibility…" → "Generating recommendations…") derived from elapsed-time heuristics while the single long-running request is in flight. This is disclosed here and in the hook's own code comment rather than presented as if the server were pushing real per-stage events. If the backend later added a background task queue with a status-polling endpoint (noted as a bonus item in the Task 1 spec), swapping this hook's internals for real polling would not require any change to `PipelineStatus.tsx` — the component only consumes `stage`, `stageMessage`, and `isRunning`, regardless of how they're produced.

The pipeline call itself is given a 5-minute client-side timeout (`services/api.ts`) since scoring runs one LLM call per discovered query sequentially and can legitimately take several minutes on a rate-limited API key.

---

## Loading, Error, and Empty States

Every async view (`Dashboard`, `ProfileDetail`, each tab) handles three states explicitly:
- **Loading** — `Skeleton` placeholders shaped like the eventual content, not a generic spinner, so the layout doesn't jump.
- **Error** — `ErrorState` with the normalized message and a retry button.
- **Empty** — `EmptyState` with a specific, actionable message (e.g. "Run the pipeline to generate content recommendations" rather than a bare "No data").

---

## What Was Deliberately Left Out

- **No global state library** (Redux/Zustand/Jotai). Each page/tab owns its own data via a dedicated hook; nothing here needs cross-page shared state beyond what URL params (`profileUuid`) already provide.
- **No component tests / Storybook** (bonus items) — out of scope given the time budget; the component boundaries are small and single-purpose enough that they'd be straightforward to add (each one takes typed props and renders deterministically from them).
- **No optimistic updates** on recheck/create — both are quick enough (single API round-trip) that the loading-state pattern already in place covers it without the added complexity of rollback-on-failure logic.
