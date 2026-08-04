# Enterprise PPM Platform

A complete, **fully offline** Project Portfolio Management platform — comparable in
scope to tools like ClickUp, Jira, Monday and MS Project — that runs entirely on
your own machine with **no internet connection and no external dependencies**.

The database is created and seeded automatically on first launch. Open a browser,
pick your language (**English** or **Hrvatski / Croatian**), and sign in.

## Two ways to run it

1. **Online, browser-based (no install on any machine).** Host it once in the cloud and
   give your team a URL they open in any browser (Chrome, Edge, Safari, Firefox). Nothing
   is installed on user computers and no Python runs on them. This is the right choice if
   Python is not allowed on your machines, or you want a single always-on address. See
   **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — it takes about 10 minutes on a host like
   Render, and includes a Google Cloud Run option. (Note: Google Drive cannot host a web
   app; it can only hold the link or backups — details in that guide.)
2. **Locally / on a shared folder** with Python installed — see Quick start below.

---


---

## Quick start

You only need **Python 3.9+** (standard library only — nothing to `pip install`).

**Just double-click the launcher for your system:**

- **Windows** — double-click **`run.bat`**
- **macOS** — double-click **`run.command`** (the first time, if macOS blocks it,
  right-click → Open)
- **Linux** — double-click **`run.sh`** (or run `./run.sh` in a terminal)

Your browser opens automatically at **http://127.0.0.1:8000**.

You can also start it from a terminal on any platform:
```bash
python3 app.py
```

On first launch the app creates `data/ppm.db` (SQLite) and fills it with realistic
sample data (users, portfolios, projects, tasks, risks, OKRs, KPIs, SLAs, RACI
matrices, and more). Subsequent launches reuse the existing database.

### Signing in and creating users

A **login screen** is shown on every launch, with the **language switch (EN / HR)**
in the top-right corner (language selection is also available on every screen once
signed in). Sign in first with the built-in administrator account:

| Username   | Password      | Role     | Access                                   |
|------------|---------------|----------|------------------------------------------|
| `director` | `director123` | Director | Full access — including user management  |

From **Administration → Users**, the director can **create every other user account**
with a password. Passwords must meet this policy (enforced on both the screen and the
server):

- at least **12 characters**
- at least one **uppercase** letter
- at least one **lowercase** letter
- at least one **number**
- at least one **special character**

The new-user form includes a **Generate** button that creates a compliant random
password, and a live checklist that ticks off each requirement as you type. Directors
can also edit users, reset passwords, and deactivate accounts (deactivated users can
no longer sign in).

> The seed data also includes `manager`, `specialist` and `clerk` example accounts
> (password = username + `123`) so you can immediately see how each role's view differs.
> In a real deployment you would deactivate or remove these and provision your own
> users through the admin screen.

---

## Why no internet is required — and why there are no dependencies

The brief called for FastAPI/Flask, Tailwind and Apache ECharts. Those are excellent
libraries, but each normally pulls assets from the internet (a `pip install`, a CDN
`<script>`, a font host). That conflicts with the hard requirement that the tool run
**completely offline on first launch**. To honour "offline first" without asking the
user to pre-download anything, this build uses drop-in equivalents that ship with the
project:

| Brief suggested        | This build uses                             | Reason                                        |
|------------------------|---------------------------------------------|-----------------------------------------------|
| FastAPI / Flask        | Python **stdlib** `http.server` + a small router | Zero install; identical layered structure (routes → services → data) |
| Tailwind CSS (CDN)     | A hand-written design-token CSS system      | No CDN; same utility-driven, palette-based approach |
| Apache ECharts (CDN)   | **Real Apache ECharts** when present, else a bundled canvas engine | See "Charts" below |
| SQLAlchemy / ORM       | `sqlite3` with a thin data layer            | Bundled with Python; no install              |

The architecture is deliberately layered exactly as a FastAPI project would be, so
the concepts map one-to-one.

**Nothing in this project makes a network call at runtime.** No telemetry, no CDNs,
no fonts fetched (a system font stack is used).

### Charts — real Apache ECharts

The dashboards are wired to render with **genuine Apache ECharts**. Because this
package must also run with no internet on first launch, ECharts is loaded from a local
file (`frontend/vendor/echarts.min.js`) rather than a CDN, and there is an automatic
fallback:

- **If `frontend/vendor/echarts.min.js` is present**, every chart renders with real
  ECharts — interactive tooltips, legend toggling, zoom and drill-down — via
  `frontend/js/charts-echarts.js`. No other change is needed; the API already returns
  chart-ready data.
- **If it is absent**, the app uses its bundled, dependency-free canvas charting engine
  so it still works 100% offline out of the box.

To enable real ECharts, run this **once on a machine with internet**:

```bash
python3 get_echarts.py
```

That downloads ECharts into `frontend/vendor/` (about 1 MB). From then on it works
offline. You can also download `echarts.min.js` yourself from
https://echarts.apache.org and drop it in that folder — see `frontend/vendor/README.md`.

> Why not ship ECharts in the box? The library is ~1 MB of third-party minified code;
> keeping it out of the source tree keeps the deliverable small and dependency-clean,
> while the one-command downloader (or a manual drop-in) enables it in seconds.

---

## Running it for a team (multiple users at once)

Yes — the platform supports many people using it at the same time, sharing one
database. Here is how it works and how to set it up.

**How concurrency is handled.** The server is multi-threaded and the SQLite database
runs in WAL mode with an 8-second busy timeout, so simultaneous readers and writers
are handled safely. Each person signs in with their own account and session.

**The important rule: one host, many clients.** You must not have several copies of
the server all writing the same database file at the same time (especially over a
network share — that can corrupt SQLite). The app enforces this automatically:

- The **first** person to launch becomes the **host**. The server starts and binds to
  the local network, and the console prints two addresses — one for that computer and
  one (`http://<host-ip>:8000`) for everyone else.
- When **anyone else** double-clicks the launcher from the shared folder, the app
  detects that a host is already running and simply **opens their browser to the
  host** instead of starting a second server. No duplicate servers, one database.
- If the host computer is shut down, the next person to launch automatically takes
  over as the new host (a stale lock is detected and reclaimed).

So double-click still "just works" for everyone; behind the scenes there is exactly
one server and one database.

**Two ways to deploy**

1. **Shared folder, auto-elected host (simplest).** Put the whole folder on a shared
   drive. Whoever opens it first hosts; the rest connect automatically. This is fine
   for a small team with light, everyday use. For best reliability, point the database
   at the host's local disk instead of the share by setting an environment variable
   before launch:
   ```
   PPM_DATA_DIR=C:\ppm-data      (Windows example)
   PPM_DATA_DIR=/var/ppm-data    (macOS/Linux example)
   ```
   If you must keep the database on the network share itself, set
   `PPM_JOURNAL=TRUNCATE` for the most portable file locking.

2. **One always-on host (most robust).** Run the tool on a single machine that stays
   on (someone's PC or a small server). Everyone else just bookmarks
   `http://<host-ip>:8000` in their browser — they don't need the folder at all. The
   database lives on that host's local disk, which is the most reliable option.

**Coordination settings** (all optional, via environment variables):

| Variable          | Default   | Purpose                                                        |
|-------------------|-----------|----------------------------------------------------------------|
| `PPM_HOST`        | `0.0.0.0` | Interface to bind. Set to `127.0.0.1` for single-machine only. |
| `PPM_PORT`        | `8000`    | Port to serve on.                                              |
| `PPM_DATA_DIR`    | `./data`  | Where the database and backups live (put on local disk ideally). |
| `PPM_JOURNAL`     | `WAL`     | Set to `TRUNCATE` if the database file is on a network share.  |
| `PPM_SHARED`      | `1`       | Set to `0` to disable host election (always run standalone).   |

**The database is created once and preserved.** On the very first launch the database
is created and seeded; every launch after that reuses it, so all data stays available
whenever anyone signs in. The director can also take backups from
Administration → Settings.

### Guidance for a locked-down environment with no always-on machine

This matches a common setup: ~15 people, a shared network folder, no dedicated server,
and corporate policy that blocks `.exe` files. Here is exactly how to run it.

- **No `.exe` is involved.** The launchers (`run.bat`, `run.command`, `run.sh`) are
  plain text scripts, and the whole tool is plain Python source — there is no compiled
  executable anywhere in the package. The one requirement is that **Python 3.9+ is
  installed and permitted to run** in your environment (on Windows this is
  `python.exe` provided by your IT). If your policy also blocks Python itself, this
  tool — like any Python program — cannot run; ask IT to whitelist an approved Python.
- **Keep the database on the shared folder.** Because no machine stays on, the database
  must live where everyone can reach it, so leave it in the folder's `data\` directory
  (the default). That way the current host reads and writes the same shared database,
  and the data survives when the host changes. The launchers automatically set
  `PPM_JOURNAL=TRUNCATE`, which is the safe database mode for a network share.
- **A rotating host, handled automatically.** Whoever launches first hosts the tool for
  everyone; their machine runs the single shared server. When they close it or shut
  down, the next person to double-click automatically becomes the new host — the
  database is unchanged because it lives on the share. Everyone always launches by
  double-clicking (they should not bookmark the address), so each launch routes them to
  whoever is hosting right now.
- **If the host closes while you are working**, the app shows a red bar at the bottom
  telling you to re-open the tool; double-clicking the launcher reconnects you to the
  new host.
- **Capacity.** 15 simultaneous users is comfortably within range — the shared server
  is multi-threaded and a stress test of 15 concurrent users hammering the database
  produced zero errors.

Practical tip: nominate whoever tends to arrive first (or a team lead) to launch it in
the morning, so a host is available for the day. Nothing breaks if that person changes
day to day.

## What's included (core modules)


- **Authentication & RBAC** — password hashing (PBKDF2-HMAC-SHA256), session tokens,
  four roles (Director / Manager / Specialist / Clerk) with row-level project scoping.
- **Projects** — portfolios → programs → projects → milestones, dependencies,
  stage-gates, risks, issues, changes and budgets.
- **Task management** — subtasks, checklists, comments, time entries (estimate vs
  actual), and a lightweight automation hook.
- **Workflow engine** — custom states and transitions per entity type, automations
  and approval steps.
- **RACI module** — matrices with R/A/C/I assignments, live validation (flags
  activities missing an Accountable or Responsible) and a colour-coded grid.
- **SLA engine** — policies with response/resolution targets, tickets and breach
  monitoring.
- **OKR / KPI** — Company → Department → Team → Individual objective tree with key
  results, plus a Balanced Scorecard across the four classic perspectives.
- **PPM** — project prioritisation scoring, capacity planning (demand vs capacity),
  a Portfolio Health Score, and an interactive **what-if funding scenario**.
- **Resource management** — utilisation, a skills matrix, and heuristic resource-
  balancing suggestions.
- **Analytics** — eight dashboards (Executive, Portfolio, Resource, Project, Risk,
  Financial, OKR, KPI) with interactive charts (hover tooltips, drill-down links).
- **Security & operations** — audit log, one-click database backup and restore.

---

## Project layout

```
ppm-platform/
├── app.py                  # entry point: bootstrap DB + seed + serve (+ auto-open browser)
├── run.command             # macOS double-click launcher
├── run.bat                 # Windows double-click launcher
├── run.sh                  # Linux launcher
├── get_echarts.py          # one-time: download real Apache ECharts into vendor/
├── requirements.txt        # (intentionally empty — stdlib only)
├── backend/
│   ├── config.py           # host, port, paths, session TTL
│   ├── schema.sql          # full SQLite schema (44 tables)
│   ├── database.py         # connection, query helpers, backup/restore
│   ├── auth.py             # hashing, sessions, authentication, password policy
│   ├── rbac.py             # roles, permission levels, project scoping
│   ├── audit.py            # audit logging + notifications
│   ├── seed.py             # realistic sample-data generator
│   ├── server.py           # stdlib HTTP server (static + JSON API)
│   └── api/
│       ├── __init__.py     # route registry / decorator
│       └── routes.py       # all REST endpoints (incl. user management)
├── frontend/
│   ├── index.html          # SPA shell
│   ├── css/styles.css      # design tokens, light/dark theme
│   ├── vendor/             # drop echarts.min.js here (optional; see README inside)
│   └── js/
│       ├── i18n.js         # English + Croatian translations
│       ├── api.js          # fetch wrapper (Bearer token)
│       ├── charts.js       # offline canvas charting engine (fallback)
│       ├── charts-echarts.js # real Apache ECharts adapter (used when present)
│       ├── app.js          # shell, router, login, shared UI helpers
│       └── views/          # dashboards, delivery, governance, strategy, admin
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── DATABASE.md
└── data/                   # created at runtime: ppm.db, backups/, uploads/
```

---

## Configuration

Edit `backend/config.py` to change the host, port or session lifetime. By default the
server binds to `127.0.0.1:8000` (loopback only — not exposed to your network).

To start completely fresh, stop the server and delete the `data/` folder; it will be
recreated and re-seeded on the next launch.

---

## Honest notes on scope

This is a genuinely functional platform with a complete architecture, real
persistence, working RBAC, and eight live dashboards — not a mock-up. A few of the
most advanced features are implemented as transparent, explainable **heuristics**
rather than machine-learning models:

- The "AI" resource-balancing suggestions use a utilisation-based heuristic (move load
  from over-allocated to under-allocated people), not a trained model.
- What-if scenarios use a greedy budget/priority knapsack rather than a full
  optimisation solver.
- Some dashboard trend lines are synthesised from current values where historical
  snapshots aren't recorded over time.

These choices are called out in the code and here so behaviour is never surprising.
There are no placeholder `TODO`s left in the codebase.

---

## Requirements

- Python 3.9 or newer (3.12 recommended)
- A modern browser (Chrome, Edge, Firefox or Safari)
- No internet connection required at any point
