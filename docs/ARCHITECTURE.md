# Architecture

## Overview

The platform is a classic three-layer web application split into a **Python backend**
(HTTP server + REST API + SQLite) and a **vanilla-JavaScript single-page frontend**.
Everything runs on the local machine; the only network traffic is browser ↔ localhost.

```
Browser (SPA)  ──HTTP/JSON──►  Python HTTP server  ──►  Service/route layer  ──►  SQLite
   charts.js                      server.py               api/routes.py            ppm.db
   views/*.js                                             auth · rbac · audit
```

## Backend layers

1. **Transport — `backend/server.py`**
   A `ThreadingHTTPServer` from the standard library. It serves the static SPA from
   `frontend/` (with an SPA fallback to `index.html`) and dispatches `/api/*` requests
   to the route layer. It parses JSON bodies, attaches the authenticated user and
   client IP to a request context, guards against path traversal, and serialises
   responses. No third-party web framework is used.

2. **Routing — `backend/api/__init__.py` + `routes.py`**
   A tiny decorator-based registry (`@route("GET", "/api/...")`) mirrors how FastAPI
   or Flask organise endpoints. Path parameters use named regex groups. Each handler
   receives a `ctx` dict (`user`, `body`, `params`, `ip`) and returns plain Python
   objects that are JSON-encoded automatically. Errors are raised as `ApiError` and
   mapped to HTTP status codes.

3. **Domain services**
   - `auth.py` — PBKDF2-HMAC-SHA256 password hashing, session creation/validation,
     bearer-token lookup.
   - `rbac.py` — role levels (Director 100 / Manager 70 / Specialist 40 / Clerk 10),
     permission checks, and **row-level project scoping** (`visible_project_ids`).
   - `audit.py` — append-only audit logging and in-app notifications.

4. **Data — `backend/database.py` + `schema.sql`**
   A thin wrapper over `sqlite3` providing `query`, `query_one`, `execute`,
   `executemany`, plus `backup_db` / `restore_db`. Connections are thread-local, run
   in WAL mode with foreign keys enforced, and return dict-like rows. The schema is
   pure SQL applied idempotently on boot.

5. **Bootstrap — `app.py` + `seed.py`**
   On launch, `app.py` ensures the schema exists, runs the idempotent seeder (which
   no-ops if data is already present), then starts the server and prints the sample
   logins.

## Frontend layers

The SPA has no build step — the browser loads plain ES5-compatible modules in order.

- **`i18n.js`** — English + Croatian dictionaries and `window.t(key)` resolution.
- **`api.js`** — a `fetch` wrapper that attaches the bearer token and centralises
  401 handling (auto-logout).
- **`charts.js`** — a dependency-free canvas charting engine: line, bar, horizontal
  bar, donut, heatmap, gauge, scatter and treemap, each with hover tooltips and
  theme-aware colours.
- **`app.js`** — the application shell: sidebar navigation (filtered by role level),
  top bar (search, language, theme, notifications), a hash-based router, and shared
  UI helpers (`badge`, `pbar`, `avatar`, `statCard`, `modal`, `toast`).
- **`views/*.js`** — feature screens grouped by area:
  - `dashboards.js` — Executive, Portfolio, Resource, Financial, Risk, OKR, KPI
  - `delivery.js` — Projects, Project detail, Tasks, Kanban (drag & drop), Gantt, Calendar
  - `governance.js` — Workflow, RACI, SLA, Approvals, Audit
  - `strategy.js` — Capacity & PPM (prioritisation, health, what-if)
  - `admin.js` — Users, Settings & Backups, personal preferences

Each view registers itself with `PPM.register(route, renderFn)` and pulls its data
from the API on demand.

## Request lifecycle

1. Browser requests a route (e.g. `#executive`); the router calls the view.
2. The view calls `API.get("/api/dashboard/executive")` with the bearer token.
3. `server.py` authenticates the token, builds `ctx`, and dispatches to the handler.
4. The handler applies RBAC scoping, queries SQLite, aggregates, and returns JSON.
5. The view renders HTML and hands chart-ready data to `charts.js`.

## Security model

- Passwords are never stored in plaintext (salted PBKDF2, 120k iterations).
- Sessions are opaque tokens with a 12-hour TTL, sent as `Authorization: Bearer`.
- Every mutating action is checked against the caller's role level, and project reads
  are scoped to what the user is allowed to see.
- All writes and sensitive reads are recorded in the audit log with actor, action,
  entity, timestamp and IP.
- The server binds to loopback only by default.

## Design trade-offs

Using the standard library instead of a framework keeps the install at *zero* and the
runtime fully offline, at the cost of some conveniences (no automatic OpenAPI docs,
manual JSON handling). The layering is intentionally framework-shaped so the code
could be ported to FastAPI with minimal restructuring.
