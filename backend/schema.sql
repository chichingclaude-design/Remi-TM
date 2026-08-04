-- ============================================================================
-- Enterprise PPM Platform - SQLite schema
-- Auto-created on first launch. Safe to run repeatedly (IF NOT EXISTS).
-- ============================================================================
PRAGMA foreign_keys = ON;

-- ---------- Identity, RBAC ---------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    level       INTEGER NOT NULL,              -- 100 director, 70 manager, 40 specialist, 10 clerk
    description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT NOT NULL UNIQUE,          -- e.g. project.create, task.update
    description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS teams (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    department  TEXT,
    description TEXT,
    manager_id  INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS destinations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    region      TEXT,
    manager_id  INTEGER REFERENCES users(id),
    description TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    email         TEXT NOT NULL UNIQUE,
    full_name     TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    salt          TEXT NOT NULL,
    role_id       INTEGER NOT NULL REFERENCES roles(id),
    team_id       INTEGER REFERENCES teams(id),
    destination_id INTEGER REFERENCES destinations(id),
    job_title     TEXT,
    capacity_hours REAL NOT NULL DEFAULT 40,   -- weekly capacity
    avatar_color  TEXT DEFAULT '#2563eb',
    locale        TEXT DEFAULT 'en',
    theme         TEXT DEFAULT 'light',
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

-- ---------- Portfolio / Program / Project ------------------------------------
CREATE TABLE IF NOT EXISTS portfolios (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    description    TEXT,
    strategic_goal TEXT,
    owner_id       INTEGER REFERENCES users(id),
    status         TEXT NOT NULL DEFAULT 'active',
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS programs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE SET NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    manager_id   INTEGER REFERENCES users(id),
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    code           TEXT UNIQUE,
    portfolio_id   INTEGER REFERENCES portfolios(id) ON DELETE SET NULL,
    program_id     INTEGER REFERENCES programs(id) ON DELETE SET NULL,
    destination_id INTEGER REFERENCES destinations(id) ON DELETE SET NULL,
    name           TEXT NOT NULL,
    description    TEXT,
    manager_id     INTEGER REFERENCES users(id),
    status         TEXT NOT NULL DEFAULT 'planning',  -- planning,active,on_hold,completed,cancelled
    priority       TEXT NOT NULL DEFAULT 'medium',    -- low,medium,high,critical
    health         TEXT NOT NULL DEFAULT 'green',      -- green,amber,red
    stage_gate     TEXT NOT NULL DEFAULT 'G0',         -- G0..G5 stage-gate
    start_date     TEXT,
    end_date       TEXT,
    budget         REAL NOT NULL DEFAULT 0,
    actual_cost    REAL NOT NULL DEFAULT 0,
    progress       REAL NOT NULL DEFAULT 0,            -- 0..100
    priority_score REAL NOT NULL DEFAULT 0,            -- computed for PPM ranking
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS milestones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    due_date    TEXT,
    status      TEXT NOT NULL DEFAULT 'open'          -- open,done,missed
);

CREATE TABLE IF NOT EXISTS project_dependencies (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    depends_on_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    type          TEXT NOT NULL DEFAULT 'FS'          -- FS,SS,FF,SF
);

CREATE TABLE IF NOT EXISTS stage_gates (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    gate       TEXT NOT NULL,                         -- G0..G5
    status     TEXT NOT NULL DEFAULT 'pending',       -- pending,passed,failed,skipped
    decision   TEXT,
    decided_by INTEGER REFERENCES users(id),
    decided_at TEXT
);

-- ---------- Tasks ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id     INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    description    TEXT,
    status         TEXT NOT NULL DEFAULT 'todo',       -- todo,in_progress,review,blocked,done
    priority       TEXT NOT NULL DEFAULT 'medium',
    assignee_id    INTEGER REFERENCES users(id),
    reporter_id    INTEGER REFERENCES users(id),
    estimate_hours REAL NOT NULL DEFAULT 0,
    actual_hours   REAL NOT NULL DEFAULT 0,
    start_date     TEXT,
    due_date       TEXT,
    progress       REAL NOT NULL DEFAULT 0,
    workflow_id    INTEGER REFERENCES workflows(id),
    order_index    INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checklists (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    text        TEXT NOT NULL,
    is_done     INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS task_dependencies (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type          TEXT NOT NULL DEFAULT 'FS'
);

CREATE TABLE IF NOT EXISTS time_entries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    hours      REAL NOT NULL,
    entry_date TEXT NOT NULL DEFAULT (date('now')),
    note       TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Collaboration ----------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,                        -- task,project,risk,...
    entity_id   INTEGER NOT NULL,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id   INTEGER NOT NULL,
    filename    TEXT NOT NULL,
    filepath    TEXT,
    size_bytes  INTEGER DEFAULT 0,
    uploaded_by INTEGER REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL DEFAULT 'info',
    title      TEXT NOT NULL,
    body       TEXT,
    link       TEXT,
    is_read    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id),
    action      TEXT NOT NULL,                        -- create,update,delete,login,...
    entity_type TEXT,
    entity_id   INTEGER,
    details     TEXT,
    ip          TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Risk / Issue / Change --------------------------------------------
CREATE TABLE IF NOT EXISTS risks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    probability INTEGER NOT NULL DEFAULT 3,           -- 1..5
    impact      INTEGER NOT NULL DEFAULT 3,           -- 1..5
    severity    INTEGER NOT NULL DEFAULT 9,           -- probability*impact
    status      TEXT NOT NULL DEFAULT 'open',         -- open,mitigating,closed
    owner_id    INTEGER REFERENCES users(id),
    mitigation  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS issues (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    severity    TEXT NOT NULL DEFAULT 'medium',
    status      TEXT NOT NULL DEFAULT 'open',
    owner_id    INTEGER REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS changes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT,
    impact       TEXT NOT NULL DEFAULT 'medium',
    status       TEXT NOT NULL DEFAULT 'requested',   -- requested,approved,rejected,implemented
    requested_by INTEGER REFERENCES users(id),
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Workflow engine --------------------------------------------------
CREATE TABLE IF NOT EXISTS workflows (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'task',
    description TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS workflow_states (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT DEFAULT '#64748b',
    order_index INTEGER NOT NULL DEFAULT 0,
    is_initial  INTEGER NOT NULL DEFAULT 0,
    is_final    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workflow_transitions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id      INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    from_state_id    INTEGER REFERENCES workflow_states(id) ON DELETE CASCADE,
    to_state_id      INTEGER REFERENCES workflow_states(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    requires_approval INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS automations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    trigger_type  TEXT NOT NULL,                      -- status_change,due_soon,created,...
    condition_json TEXT,
    action_json   TEXT,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS approvals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id   INTEGER NOT NULL,
    title       TEXT NOT NULL,
    requested_by INTEGER REFERENCES users(id),
    approver_id INTEGER REFERENCES users(id),
    status      TEXT NOT NULL DEFAULT 'pending',      -- pending,approved,rejected
    step        INTEGER NOT NULL DEFAULT 1,
    comment     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    decided_at  TEXT
);

-- ---------- OKR / KPI --------------------------------------------------------
CREATE TABLE IF NOT EXISTS objectives (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id   INTEGER REFERENCES objectives(id) ON DELETE SET NULL,
    level       TEXT NOT NULL DEFAULT 'company',      -- company,department,team,individual
    title       TEXT NOT NULL,
    description TEXT,
    owner_id    INTEGER REFERENCES users(id),
    team_id     INTEGER REFERENCES teams(id),
    period      TEXT,                                 -- e.g. 2025-Q3
    progress    REAL NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'on_track',     -- on_track,at_risk,off_track,done
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS key_results (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    objective_id INTEGER NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    target       REAL NOT NULL DEFAULT 100,
    current      REAL NOT NULL DEFAULT 0,
    baseline     REAL NOT NULL DEFAULT 0,
    unit         TEXT DEFAULT '%',
    progress     REAL NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'on_track'
);

CREATE TABLE IF NOT EXISTS kpis (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    category    TEXT,
    perspective TEXT NOT NULL DEFAULT 'financial',    -- balanced scorecard: financial,customer,internal,learning
    owner_id    INTEGER REFERENCES users(id),
    team_id     INTEGER REFERENCES teams(id),
    target      REAL NOT NULL DEFAULT 0,
    current     REAL NOT NULL DEFAULT 0,
    unit        TEXT DEFAULT '',
    direction   TEXT NOT NULL DEFAULT 'up',           -- up=higher better, down=lower better
    period      TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kpi_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kpi_id      INTEGER NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
    value       REAL NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (date('now'))
);

-- ---------- SLA engine -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sla_policies (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT NOT NULL,
    priority           TEXT NOT NULL DEFAULT 'medium',
    response_minutes   INTEGER NOT NULL DEFAULT 240,
    resolution_minutes INTEGER NOT NULL DEFAULT 1440,
    description        TEXT
);

CREATE TABLE IF NOT EXISTS sla_tickets (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    title                TEXT NOT NULL,
    priority             TEXT NOT NULL DEFAULT 'medium',
    policy_id            INTEGER REFERENCES sla_policies(id),
    project_id           INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    assignee_id          INTEGER REFERENCES users(id),
    status               TEXT NOT NULL DEFAULT 'open',   -- open,responded,resolved,closed
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    response_due         TEXT,
    resolution_due       TEXT,
    first_response_at    TEXT,
    resolved_at          TEXT,
    breached_response    INTEGER NOT NULL DEFAULT 0,
    breached_resolution  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sla_escalations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id  INTEGER NOT NULL REFERENCES sla_tickets(id) ON DELETE CASCADE,
    level      INTEGER NOT NULL DEFAULT 1,
    escalated_to INTEGER REFERENCES users(id),
    reason     TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- RACI -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS raci_matrices (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS raci_activities (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    matrix_id   INTEGER NOT NULL REFERENCES raci_matrices(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS raci_assignments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL REFERENCES raci_activities(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    letter      TEXT NOT NULL                         -- R,A,C,I
);

-- ---------- Resource management ---------------------------------------------
CREATE TABLE IF NOT EXISTS resource_allocations (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id         INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    allocation_percent REAL NOT NULL DEFAULT 0,
    start_date         TEXT,
    end_date           TEXT
);

CREATE TABLE IF NOT EXISTS skills (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL UNIQUE,
    category TEXT
);

CREATE TABLE IF NOT EXISTS user_skills (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    level    INTEGER NOT NULL DEFAULT 3              -- 1..5
);

-- ---------- PPM scenarios ----------------------------------------------------
CREATE TABLE IF NOT EXISTS scenarios (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    description    TEXT,
    definition_json TEXT,
    created_by     INTEGER REFERENCES users(id),
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Settings ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- ---------- Indexes ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_project   ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee  ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_time_user       ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user      ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notif_user      ON notifications(user_id, is_read);
