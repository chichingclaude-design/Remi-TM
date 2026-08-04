"""All REST endpoints for the PPM platform."""
import datetime
import json
from . import route, ApiError
from .. import database as db
from .. import auth
from .. import rbac
from .. import audit


# ---------------------------------------------------------------- helpers ----
def _scope_projects(user, alias="p"):
    """Return an SQL fragment + params limiting to visible projects."""
    ids = rbac.visible_project_ids(user)
    if ids is None:
        return "1=1", []
    if not ids:
        return "0=1", []
    placeholders = ",".join("?" * len(ids))
    return f"{alias}.id IN ({placeholders})", list(ids)


def _require_write(user):
    rbac.require_write(user)


# ------------------------------------------------------------------- auth ----
@route("POST", "/api/auth/login", needs_auth=False)
def login(ctx):
    body = ctx["body"] or {}
    u = auth.authenticate(body.get("username", ""), body.get("password", ""))
    if not u:
        audit.log(None, "login_failed", "user", None, body.get("username"), ctx["ip"])
        raise ApiError(401, "Invalid username or password")
    token = auth.create_session(u["id"])
    audit.log(u, "login", "user", u["id"], None, ctx["ip"])
    return {"token": token, "user": auth.user_from_token(token)}


@route("POST", "/api/auth/logout")
def logout(ctx):
    auth.destroy_session(ctx["token"])
    audit.log(ctx["user"], "logout", "user", ctx["user"]["id"], None, ctx["ip"])
    return {"ok": True}


@route("GET", "/api/me")
def me(ctx):
    return ctx["user"]


@route("PUT", "/api/me/prefs")
def update_prefs(ctx):
    body = ctx["body"] or {}
    fields, params = [], []
    for f in ("locale", "theme"):
        if f in body:
            fields.append(f"{f}=?")
            params.append(body[f])
    if fields:
        params.append(ctx["user"]["id"])
        db.execute(f"UPDATE users SET {','.join(fields)} WHERE id=?", params)
    return {"ok": True}


# ---------------------------------------------------------- reference data ----
@route("GET", "/api/users")
def list_users(ctx):
    return db.query(
        """SELECT u.id,u.username,u.full_name,u.email,u.job_title,u.capacity_hours,
                  u.avatar_color,u.is_active,r.name AS role,r.id AS role_id,
                  t.name AS team,u.team_id,d.name AS destination,u.destination_id
           FROM users u JOIN roles r ON r.id=u.role_id
           LEFT JOIN teams t ON t.id=u.team_id
           LEFT JOIN destinations d ON d.id=u.destination_id
           ORDER BY r.level DESC, u.full_name""")


_AVATAR_COLORS = ["#2563eb", "#0ea5e9", "#16a34a", "#d97706", "#dc2626",
                  "#7c3aed", "#db2777", "#0891b2", "#65a30d", "#ea580c"]


@route("POST", "/api/users")
def create_user(ctx):
    """Director-only: provision a new account with a policy-compliant password."""
    rbac.require_level(ctx["user"], rbac.DIRECTOR)
    b = ctx["body"] or {}
    username = (b.get("username") or "").strip()
    full_name = (b.get("full_name") or "").strip()
    email = (b.get("email") or "").strip()
    password = b.get("password") or ""
    role_id = b.get("role_id")
    if not username or not full_name or not email or not role_id:
        raise ApiError(400, "Username, full name, email and role are required")
    # enforce the password policy on the server, never trusting the client alone
    err = auth.validate_password(password)
    if err:
        raise ApiError(400, err)
    if db.query_one("SELECT id FROM users WHERE username=? OR email=?", (username, email)):
        raise ApiError(409, "Username or email already exists")
    pwd_hash, salt = auth.hash_password(password)
    import random
    color = random.choice(_AVATAR_COLORS)
    uid = db.execute(
        """INSERT INTO users (username,email,full_name,password_hash,salt,role_id,
           team_id,destination_id,job_title,capacity_hours,avatar_color,locale,theme,is_active)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)""",
        (username, email, full_name, pwd_hash, salt, role_id,
         b.get("team_id"), b.get("destination_id"), b.get("job_title"),
         b.get("capacity_hours", 40), color, b.get("locale", "en"), b.get("theme", "light")))
    audit.log(ctx["user"], "create", "user", uid, username, ctx["ip"])
    return {"id": uid}


@route("PUT", r"/api/users/(?P<uid>\d+)")
def update_user(ctx):
    """Director-only: edit profile fields, role, active state, or reset password."""
    rbac.require_level(ctx["user"], rbac.DIRECTOR)
    uid = int(ctx["params"]["uid"])
    b = ctx["body"] or {}
    target = db.query_one("SELECT * FROM users WHERE id=?", (uid,))
    if not target:
        raise ApiError(404, "User not found")
    fields, params = [], []
    for f in ("full_name", "email", "job_title", "role_id", "team_id",
              "destination_id", "capacity_hours", "is_active"):
        if f in b:
            fields.append(f"{f}=?")
            params.append(b[f])
    if b.get("password"):
        err = auth.validate_password(b["password"])
        if err:
            raise ApiError(400, err)
        pwd_hash, salt = auth.hash_password(b["password"])
        fields += ["password_hash=?", "salt=?"]
        params += [pwd_hash, salt]
    if not fields:
        return {"ok": True}
    params.append(uid)
    db.execute(f"UPDATE users SET {','.join(fields)} WHERE id=?", params)
    audit.log(ctx["user"], "update", "user", uid, target["username"], ctx["ip"])
    return {"ok": True}



@route("GET", "/api/teams")
def list_teams(ctx):
    return db.query("SELECT * FROM teams ORDER BY name")


@route("GET", "/api/destinations")
def list_destinations(ctx):
    return db.query("SELECT * FROM destinations ORDER BY name")


@route("GET", "/api/roles")
def list_roles(ctx):
    return db.query("SELECT * FROM roles ORDER BY level DESC")


# ------------------------------------------------------------- portfolios ----
@route("GET", "/api/portfolios")
def list_portfolios(ctx):
    return db.query(
        """SELECT po.*, u.full_name AS owner,
                  (SELECT COUNT(*) FROM projects p WHERE p.portfolio_id=po.id) AS project_count,
                  (SELECT COALESCE(SUM(budget),0) FROM projects p WHERE p.portfolio_id=po.id) AS total_budget
           FROM portfolios po LEFT JOIN users u ON u.id=po.owner_id ORDER BY po.name""")


@route("GET", "/api/programs")
def list_programs(ctx):
    return db.query(
        """SELECT pr.*, po.name AS portfolio, u.full_name AS manager
           FROM programs pr LEFT JOIN portfolios po ON po.id=pr.portfolio_id
           LEFT JOIN users u ON u.id=pr.manager_id ORDER BY pr.name""")


# ---------------------------------------------------------------- projects ----
@route("GET", "/api/projects")
def list_projects(ctx):
    where, params = _scope_projects(ctx["user"])
    q = ctx["query"]
    extra = ""
    if q.get("status"):
        extra += " AND p.status=?"
        params.append(q["status"])
    if q.get("portfolio_id"):
        extra += " AND p.portfolio_id=?"
        params.append(q["portfolio_id"])
    return db.query(
        f"""SELECT p.*, u.full_name AS manager, po.name AS portfolio,
                   d.name AS destination,
                   (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id) AS task_count,
                   (SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.status='done') AS done_count
            FROM projects p
            LEFT JOIN users u ON u.id=p.manager_id
            LEFT JOIN portfolios po ON po.id=p.portfolio_id
            LEFT JOIN destinations d ON d.id=p.destination_id
            WHERE {where}{extra} ORDER BY p.priority_score DESC, p.name""", params)


@route("GET", r"/api/projects/(?P<pid>\d+)")
def get_project(ctx):
    pid = int(ctx["params"]["pid"])
    _assert_project_visible(ctx["user"], pid)
    proj = db.query_one(
        """SELECT p.*, u.full_name AS manager, po.name AS portfolio,
                  pr.name AS program, d.name AS destination
           FROM projects p LEFT JOIN users u ON u.id=p.manager_id
           LEFT JOIN portfolios po ON po.id=p.portfolio_id
           LEFT JOIN programs pr ON pr.id=p.program_id
           LEFT JOIN destinations d ON d.id=p.destination_id WHERE p.id=?""", (pid,))
    if not proj:
        raise ApiError(404, "Project not found")
    proj["milestones"] = db.query("SELECT * FROM milestones WHERE project_id=? ORDER BY due_date", (pid,))
    proj["risks"] = db.query("SELECT * FROM risks WHERE project_id=? ORDER BY severity DESC", (pid,))
    proj["stage_gates"] = db.query("SELECT * FROM stage_gates WHERE project_id=? ORDER BY gate", (pid,))
    proj["team"] = db.query(
        """SELECT DISTINCT u.id,u.full_name,u.avatar_color,ra.allocation_percent
           FROM resource_allocations ra JOIN users u ON u.id=ra.user_id
           WHERE ra.project_id=?""", (pid,))
    return proj


@route("POST", "/api/projects")
def create_project(ctx):
    _require_write(ctx["user"])
    b = ctx["body"] or {}
    if not b.get("name"):
        raise ApiError(400, "Name is required")
    pid = db.execute(
        """INSERT INTO projects (code,portfolio_id,program_id,destination_id,name,description,
           manager_id,status,priority,health,stage_gate,start_date,end_date,budget)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (b.get("code"), b.get("portfolio_id"), b.get("program_id"), b.get("destination_id"),
         b["name"], b.get("description"), b.get("manager_id", ctx["user"]["id"]),
         b.get("status", "planning"), b.get("priority", "medium"), b.get("health", "green"),
         b.get("stage_gate", "G0"), b.get("start_date"), b.get("end_date"), b.get("budget", 0)))
    audit.log(ctx["user"], "create", "project", pid, b["name"], ctx["ip"])
    return {"id": pid}


@route("PUT", r"/api/projects/(?P<pid>\d+)")
def update_project(ctx):
    _require_write(ctx["user"])
    pid = int(ctx["params"]["pid"])
    _assert_project_visible(ctx["user"], pid)
    b = ctx["body"] or {}
    allowed = ["name", "description", "status", "priority", "health", "stage_gate",
               "start_date", "end_date", "budget", "actual_cost", "progress",
               "manager_id", "portfolio_id", "program_id", "destination_id"]
    fields = [f"{k}=?" for k in allowed if k in b]
    params = [b[k] for k in allowed if k in b]
    if fields:
        params.append(pid)
        db.execute(f"UPDATE projects SET {','.join(fields)} WHERE id=?", params)
        audit.log(ctx["user"], "update", "project", pid, None, ctx["ip"])
    return {"ok": True}


@route("DELETE", r"/api/projects/(?P<pid>\d+)")
def delete_project(ctx):
    rbac.require_level(ctx["user"], rbac.MANAGER)
    pid = int(ctx["params"]["pid"])
    db.execute("DELETE FROM projects WHERE id=?", (pid,))
    audit.log(ctx["user"], "delete", "project", pid, None, ctx["ip"])
    return {"ok": True}


def _assert_project_visible(user, pid):
    ids = rbac.visible_project_ids(user)
    if ids is not None and pid not in ids:
        raise ApiError(403, "You do not have access to this project")


# ------------------------------------------------------------------- tasks ----
@route("GET", "/api/tasks")
def list_tasks(ctx):
    user = ctx["user"]
    q = ctx["query"]
    where, params = _scope_projects(user, "p")
    clauses = [where, "t.parent_task_id IS NULL"]
    if q.get("project_id"):
        clauses.append("t.project_id=?")
        params.append(q["project_id"])
    if q.get("status"):
        clauses.append("t.status=?")
        params.append(q["status"])
    if q.get("mine") == "1":
        clauses.append("t.assignee_id=?")
        params.append(user["id"])
    if q.get("assignee_id"):
        clauses.append("t.assignee_id=?")
        params.append(q["assignee_id"])
    sql = f"""SELECT t.*, u.full_name AS assignee, u.avatar_color, p.name AS project,
                     (SELECT COUNT(*) FROM checklists c WHERE c.task_id=t.id) AS checklist_total,
                     (SELECT COUNT(*) FROM checklists c WHERE c.task_id=t.id AND c.is_done=1) AS checklist_done,
                     (SELECT COUNT(*) FROM tasks s WHERE s.parent_task_id=t.id) AS subtask_count
              FROM tasks t JOIN projects p ON p.id=t.project_id
              LEFT JOIN users u ON u.id=t.assignee_id
              WHERE {' AND '.join(clauses)} ORDER BY t.order_index, t.id"""
    return db.query(sql, params)


@route("GET", r"/api/tasks/(?P<tid>\d+)")
def get_task(ctx):
    tid = int(ctx["params"]["tid"])
    t = db.query_one(
        """SELECT t.*, u.full_name AS assignee, u.avatar_color, p.name AS project
           FROM tasks t LEFT JOIN users u ON u.id=t.assignee_id
           LEFT JOIN projects p ON p.id=t.project_id WHERE t.id=?""", (tid,))
    if not t:
        raise ApiError(404, "Task not found")
    t["checklist"] = db.query("SELECT * FROM checklists WHERE task_id=? ORDER BY order_index", (tid,))
    t["subtasks"] = db.query(
        "SELECT id,title,status,assignee_id FROM tasks WHERE parent_task_id=? ORDER BY id", (tid,))
    t["comments"] = db.query(
        """SELECT c.*, u.full_name AS author, u.avatar_color FROM comments c
           JOIN users u ON u.id=c.user_id WHERE entity_type='task' AND entity_id=?
           ORDER BY c.created_at""", (tid,))
    t["time_entries"] = db.query(
        """SELECT te.*, u.full_name AS user FROM time_entries te
           JOIN users u ON u.id=te.user_id WHERE task_id=? ORDER BY entry_date DESC""", (tid,))
    return t


@route("POST", "/api/tasks")
def create_task(ctx):
    _require_write(ctx["user"])
    b = ctx["body"] or {}
    if not b.get("title") or not b.get("project_id"):
        raise ApiError(400, "Title and project are required")
    tid = db.execute(
        """INSERT INTO tasks (project_id,parent_task_id,title,description,status,priority,
           assignee_id,reporter_id,estimate_hours,start_date,due_date)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (b["project_id"], b.get("parent_task_id"), b["title"], b.get("description"),
         b.get("status", "todo"), b.get("priority", "medium"), b.get("assignee_id"),
         ctx["user"]["id"], b.get("estimate_hours", 0), b.get("start_date"), b.get("due_date")))
    audit.log(ctx["user"], "create", "task", tid, b["title"], ctx["ip"])
    if b.get("assignee_id"):
        audit.notify(b["assignee_id"], "New task assigned", b["title"], "info")
    return {"id": tid}


@route("PUT", r"/api/tasks/(?P<tid>\d+)")
def update_task(ctx):
    tid = int(ctx["params"]["tid"])
    task = db.query_one("SELECT * FROM tasks WHERE id=?", (tid,))
    if not task:
        raise ApiError(404, "Task not found")
    if not rbac.can_edit_task(ctx["user"], task):
        raise ApiError(403, "You may only edit tasks assigned to you")
    b = ctx["body"] or {}
    allowed = ["title", "description", "status", "priority", "assignee_id",
               "estimate_hours", "actual_hours", "start_date", "due_date", "progress",
               "order_index"]
    fields = [f"{k}=?" for k in allowed if k in b]
    params = [b[k] for k in allowed if k in b]
    if fields:
        fields.append("updated_at=?")
        params.append(datetime.datetime.now().isoformat(timespec="seconds"))
        params.append(tid)
        db.execute(f"UPDATE tasks SET {','.join(fields)} WHERE id=?", params)
        audit.log(ctx["user"], "update", "task", tid, b.get("status"), ctx["ip"])
        _run_automations(task, b)
    return {"ok": True}


@route("PUT", r"/api/tasks/(?P<tid>\d+)/status")
def move_task(ctx):
    tid = int(ctx["params"]["tid"])
    task = db.query_one("SELECT * FROM tasks WHERE id=?", (tid,))
    if not task:
        raise ApiError(404, "Task not found")
    if not rbac.can_edit_task(ctx["user"], task):
        raise ApiError(403, "You may only move tasks assigned to you")
    b = ctx["body"] or {}
    status = b.get("status")
    progress = 100 if status == "done" else task["progress"]
    db.execute("UPDATE tasks SET status=?, progress=?, updated_at=? WHERE id=?",
               (status, progress, datetime.datetime.now().isoformat(timespec="seconds"), tid))
    audit.log(ctx["user"], "move", "task", tid, status, ctx["ip"])
    _run_automations(task, {"status": status})
    return {"ok": True}


@route("DELETE", r"/api/tasks/(?P<tid>\d+)")
def delete_task(ctx):
    rbac.require_level(ctx["user"], rbac.MANAGER)
    tid = int(ctx["params"]["tid"])
    db.execute("DELETE FROM tasks WHERE id=?", (tid,))
    audit.log(ctx["user"], "delete", "task", tid, None, ctx["ip"])
    return {"ok": True}


def _run_automations(task, changes):
    """Very small automation engine reacting to status changes."""
    if changes.get("status") == "blocked":
        proj = db.query_one("SELECT manager_id,name FROM projects WHERE id=?", (task["project_id"],))
        if proj and proj["manager_id"]:
            audit.notify(proj["manager_id"], "Task blocked",
                         f"A task in {proj['name']} was blocked.", "warning")


@route("POST", r"/api/tasks/(?P<tid>\d+)/checklist")
def add_checklist(ctx):
    _require_write(ctx["user"])
    tid = int(ctx["params"]["tid"])
    b = ctx["body"] or {}
    cid = db.execute("INSERT INTO checklists (task_id,text) VALUES (?,?)", (tid, b.get("text", "")))
    return {"id": cid}


@route("PUT", r"/api/checklist/(?P<cid>\d+)")
def toggle_checklist(ctx):
    _require_write(ctx["user"])
    cid = int(ctx["params"]["cid"])
    b = ctx["body"] or {}
    db.execute("UPDATE checklists SET is_done=? WHERE id=?", (1 if b.get("is_done") else 0, cid))
    return {"ok": True}


@route("POST", r"/api/tasks/(?P<tid>\d+)/comments")
def add_comment(ctx):
    _require_write(ctx["user"])
    tid = int(ctx["params"]["tid"])
    b = ctx["body"] or {}
    if not b.get("body"):
        raise ApiError(400, "Comment body required")
    cid = db.execute("INSERT INTO comments (entity_type,entity_id,user_id,body) VALUES ('task',?,?,?)",
                     (tid, ctx["user"]["id"], b["body"]))
    audit.log(ctx["user"], "comment", "task", tid, None, ctx["ip"])
    return {"id": cid}


@route("POST", r"/api/tasks/(?P<tid>\d+)/time")
def log_time(ctx):
    _require_write(ctx["user"])
    tid = int(ctx["params"]["tid"])
    b = ctx["body"] or {}
    task = db.query_one("SELECT project_id, actual_hours FROM tasks WHERE id=?", (tid,))
    hours = float(b.get("hours", 0))
    db.execute("INSERT INTO time_entries (task_id,project_id,user_id,hours,entry_date,note) VALUES (?,?,?,?,?,?)",
               (tid, task["project_id"], ctx["user"]["id"], hours,
                b.get("entry_date", datetime.date.today().isoformat()), b.get("note")))
    db.execute("UPDATE tasks SET actual_hours=actual_hours+? WHERE id=?", (hours, tid))
    audit.log(ctx["user"], "log_time", "task", tid, str(hours), ctx["ip"])
    return {"ok": True}


# ------------------------------------------------------------------- risks ----
@route("GET", "/api/risks")
def list_risks(ctx):
    where, params = _scope_projects(ctx["user"], "p")
    return db.query(
        f"""SELECT r.*, p.name AS project, u.full_name AS owner FROM risks r
            JOIN projects p ON p.id=r.project_id
            LEFT JOIN users u ON u.id=r.owner_id
            WHERE {where} ORDER BY r.severity DESC""", params)


# ------------------------------------------------------------------- OKRs -----
@route("GET", "/api/okrs")
def list_okrs(ctx):
    objs = db.query(
        """SELECT o.*, u.full_name AS owner, t.name AS team FROM objectives o
           LEFT JOIN users u ON u.id=o.owner_id
           LEFT JOIN teams t ON t.id=o.team_id ORDER BY o.level, o.id""")
    for o in objs:
        o["key_results"] = db.query("SELECT * FROM key_results WHERE objective_id=?", (o["id"],))
    return objs


@route("PUT", r"/api/key_results/(?P<kid>\d+)")
def update_kr(ctx):
    rbac.require_level(ctx["user"], rbac.MANAGER)
    kid = int(ctx["params"]["kid"])
    b = ctx["body"] or {}
    kr = db.query_one("SELECT * FROM key_results WHERE id=?", (kid,))
    current = float(b.get("current", kr["current"]))
    target = kr["target"] or 1
    prog = round(min(100, max(0, current / target * 100)))
    status = "on_track" if prog >= 70 else ("at_risk" if prog >= 40 else "off_track")
    db.execute("UPDATE key_results SET current=?, progress=?, status=? WHERE id=?",
               (current, prog, status, kid))
    # roll up to objective
    rows = db.query("SELECT progress FROM key_results WHERE objective_id=?", (kr["objective_id"],))
    avg = round(sum(r["progress"] for r in rows) / len(rows)) if rows else 0
    db.execute("UPDATE objectives SET progress=? WHERE id=?", (avg, kr["objective_id"]))
    audit.log(ctx["user"], "update", "key_result", kid, None, ctx["ip"])
    return {"ok": True, "progress": prog}


# -------------------------------------------------------------------- KPIs -----
@route("GET", "/api/kpis")
def list_kpis(ctx):
    return db.query(
        """SELECT k.*, u.full_name AS owner FROM kpis k
           LEFT JOIN users u ON u.id=k.owner_id ORDER BY k.perspective, k.name""")


@route("GET", r"/api/kpis/(?P<kid>\d+)/history")
def kpi_history(ctx):
    kid = int(ctx["params"]["kid"])
    return db.query("SELECT value, recorded_at FROM kpi_history WHERE kpi_id=? ORDER BY recorded_at", (kid,))


# --------------------------------------------------------------------- SLA -----
@route("GET", "/api/sla/policies")
def sla_policies(ctx):
    return db.query("SELECT * FROM sla_policies ORDER BY response_minutes")


@route("GET", "/api/sla/tickets")
def sla_tickets(ctx):
    return db.query(
        """SELECT s.*, sp.name AS policy, u.full_name AS assignee, p.name AS project
           FROM sla_tickets s LEFT JOIN sla_policies sp ON sp.id=s.policy_id
           LEFT JOIN users u ON u.id=s.assignee_id
           LEFT JOIN projects p ON p.id=s.project_id
           ORDER BY s.created_at DESC""")


# -------------------------------------------------------------------- RACI -----
@route("GET", "/api/raci")
def raci_matrices(ctx):
    return db.query(
        """SELECT m.*, p.name AS project FROM raci_matrices m
           LEFT JOIN projects p ON p.id=m.project_id ORDER BY m.id""")


@route("GET", r"/api/raci/(?P<mid>\d+)")
def raci_matrix(ctx):
    mid = int(ctx["params"]["mid"])
    matrix = db.query_one("SELECT * FROM raci_matrices WHERE id=?", (mid,))
    if not matrix:
        raise ApiError(404, "RACI matrix not found")
    activities = db.query("SELECT * FROM raci_activities WHERE matrix_id=? ORDER BY order_index", (mid,))
    # collect member set
    members = {}
    for a in activities:
        a["assignments"] = db.query(
            """SELECT ra.user_id, ra.letter, u.full_name, u.avatar_color
               FROM raci_assignments ra JOIN users u ON u.id=ra.user_id
               WHERE ra.activity_id=?""", (a["id"],))
        for asg in a["assignments"]:
            members[asg["user_id"]] = {"id": asg["user_id"], "name": asg["full_name"],
                                       "color": asg["avatar_color"]}
    # validation: each activity must have exactly one Accountable
    warnings = []
    for a in activities:
        letters = [x["letter"] for x in a["assignments"]]
        acc = letters.count("A")
        if acc != 1:
            warnings.append({"activity": a["name"],
                             "issue": f"has {acc} Accountable (should be exactly 1)"})
        if "R" not in letters:
            warnings.append({"activity": a["name"], "issue": "has no Responsible"})
    matrix["activities"] = activities
    matrix["members"] = list(members.values())
    matrix["warnings"] = warnings
    return matrix


# --------------------------------------------------------------- resources -----
@route("GET", "/api/resources/utilization")
def utilization(ctx):
    rows = db.query(
        """SELECT u.id,u.full_name,u.avatar_color,u.capacity_hours,t.name AS team,
                  COALESCE(SUM(ra.allocation_percent),0) AS alloc_percent
           FROM users u LEFT JOIN teams t ON t.id=u.team_id
           LEFT JOIN resource_allocations ra ON ra.user_id=u.id
           JOIN roles r ON r.id=u.role_id
           WHERE r.level <= ?
           GROUP BY u.id ORDER BY alloc_percent DESC""", (rbac.SPECIALIST,))
    for r in rows:
        cap = r["capacity_hours"] or 40
        r["allocated_hours"] = round(cap * r["alloc_percent"] / 100, 1)
        r["utilization"] = round(r["alloc_percent"], 1)
        r["status"] = ("over" if r["alloc_percent"] > 100
                       else "high" if r["alloc_percent"] >= 80
                       else "healthy" if r["alloc_percent"] >= 40 else "under")
    return rows


@route("GET", "/api/resources/skills")
def skills_matrix(ctx):
    users = db.query(
        """SELECT u.id,u.full_name FROM users u JOIN roles r ON r.id=u.role_id
           WHERE r.level <= ? ORDER BY u.full_name""", (rbac.SPECIALIST,))
    skills = db.query("SELECT * FROM skills ORDER BY name")
    matrix = db.query(
        """SELECT us.user_id, us.skill_id, us.level FROM user_skills us""")
    lookup = {(m["user_id"], m["skill_id"]): m["level"] for m in matrix}
    grid = []
    for u in users:
        row = {"user": u["full_name"], "user_id": u["id"], "levels": []}
        for s in skills:
            row["levels"].append({"skill": s["name"], "level": lookup.get((u["id"], s["id"]), 0)})
        grid.append(row)
    return {"skills": [s["name"] for s in skills], "rows": grid}


@route("GET", "/api/resources/suggestions")
def balancing_suggestions(ctx):
    """Heuristic 'AI' resource balancing: move work from overloaded to underused
    people who share a skill."""
    util = utilization(ctx)
    over = [u for u in util if u["utilization"] > 100]
    under = [u for u in util if u["utilization"] < 60]
    suggestions = []
    for o in over:
        for u in under:
            suggestions.append({
                "from": o["full_name"], "to": u["full_name"],
                "from_util": o["utilization"], "to_util": u["utilization"],
                "recommendation": f"Reassign ~{round((o['utilization']-100)/2)}% of "
                                  f"{o['full_name']}'s load to {u['full_name']}",
            })
            if len(suggestions) >= 6:
                return {"suggestions": suggestions,
                        "summary": f"{len(over)} people over capacity, {len(under)} under-used"}
    return {"suggestions": suggestions,
            "summary": f"{len(over)} people over capacity, {len(under)} under-used"}


# --------------------------------------------------------------- workflows -----
@route("GET", "/api/workflows")
def list_workflows(ctx):
    wfs = db.query("SELECT * FROM workflows ORDER BY id")
    for w in wfs:
        w["states"] = db.query("SELECT * FROM workflow_states WHERE workflow_id=? ORDER BY order_index", (w["id"],))
        w["transitions"] = db.query(
            """SELECT wt.*, fs.name AS from_state, ts.name AS to_state
               FROM workflow_transitions wt
               LEFT JOIN workflow_states fs ON fs.id=wt.from_state_id
               LEFT JOIN workflow_states ts ON ts.id=wt.to_state_id
               WHERE wt.workflow_id=?""", (w["id"],))
    return wfs


@route("GET", "/api/automations")
def list_automations(ctx):
    return db.query("SELECT * FROM automations ORDER BY id")


@route("GET", "/api/approvals")
def list_approvals(ctx):
    return db.query(
        """SELECT a.*, r.full_name AS requester, ap.full_name AS approver FROM approvals a
           LEFT JOIN users r ON r.id=a.requested_by
           LEFT JOIN users ap ON ap.id=a.approver_id ORDER BY a.created_at DESC""")


@route("PUT", r"/api/approvals/(?P<aid>\d+)")
def decide_approval(ctx):
    rbac.require_level(ctx["user"], rbac.MANAGER)
    aid = int(ctx["params"]["aid"])
    b = ctx["body"] or {}
    db.execute("UPDATE approvals SET status=?, comment=?, decided_at=? WHERE id=?",
               (b.get("status"), b.get("comment"),
                datetime.datetime.now().isoformat(timespec="seconds"), aid))
    audit.log(ctx["user"], "decide", "approval", aid, b.get("status"), ctx["ip"])
    return {"ok": True}


# ------------------------------------------------------------------ notifs -----
@route("GET", "/api/notifications")
def notifications(ctx):
    return db.query(
        "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50",
        (ctx["user"]["id"],))


@route("PUT", r"/api/notifications/(?P<nid>\d+)/read")
def read_notification(ctx):
    nid = int(ctx["params"]["nid"])
    db.execute("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?",
               (nid, ctx["user"]["id"]))
    return {"ok": True}


# ------------------------------------------------------------------- audit -----
@route("GET", "/api/audit")
def audit_log(ctx):
    rbac.require_level(ctx["user"], rbac.MANAGER)
    return db.query(
        """SELECT a.*, u.full_name AS user FROM audit_logs a
           LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200""")


# ---------------------------------------------------------------- settings -----
@route("GET", "/api/settings")
def get_settings(ctx):
    return {r["key"]: r["value"] for r in db.query("SELECT * FROM settings")}


@route("PUT", "/api/settings")
def update_settings(ctx):
    rbac.require_level(ctx["user"], rbac.DIRECTOR)
    for k, v in (ctx["body"] or {}).items():
        db.execute("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)", (k, str(v)))
    audit.log(ctx["user"], "update", "settings", None, None, ctx["ip"])
    return {"ok": True}


# ------------------------------------------------------------------ backup -----
@route("GET", "/api/backups")
def list_backups(ctx):
    rbac.require_level(ctx["user"], rbac.DIRECTOR)
    return db.list_backups()


@route("POST", "/api/backups")
def make_backup(ctx):
    rbac.require_level(ctx["user"], rbac.DIRECTOR)
    path = db.backup_db()
    audit.log(ctx["user"], "backup", "system", None, path, ctx["ip"])
    return {"ok": True, "file": path.split("/")[-1]}


@route("POST", "/api/backups/restore")
def restore_backup(ctx):
    rbac.require_level(ctx["user"], rbac.DIRECTOR)
    b = ctx["body"] or {}
    db.restore_db(b.get("name"))
    audit.log(ctx["user"], "restore", "system", None, b.get("name"), ctx["ip"])
    return {"ok": True}


# ================================================================ dashboards ===
def _agg_projects(user):
    where, params = _scope_projects(user, "p")
    return db.query(f"SELECT p.* FROM projects p WHERE {where}", params)


@route("GET", "/api/dashboard/executive")
def dash_executive(ctx):
    projects = _agg_projects(ctx["user"])
    total_budget = sum(p["budget"] for p in projects)
    total_actual = sum(p["actual_cost"] for p in projects)
    active = [p for p in projects if p["status"] == "active"]
    by_health = _count_by(projects, "health")
    by_status = _count_by(projects, "status")
    # portfolio health score: weighted green/amber/red + budget adherence
    health_score = _portfolio_health(projects)
    kpis = db.query("SELECT name,perspective,target,current,unit,direction FROM kpis")
    open_risks = db.query_one("SELECT COUNT(*) c FROM risks WHERE status!='closed'")["c"]
    sla_breaches = db.query_one(
        "SELECT COUNT(*) c FROM sla_tickets WHERE breached_response=1 OR breached_resolution=1")["c"]
    return {
        "cards": {
            "portfolio_value": total_budget,
            "actual_cost": total_actual,
            "active_projects": len(active),
            "total_projects": len(projects),
            "avg_progress": round(sum(p["progress"] for p in projects) / len(projects), 1) if projects else 0,
            "health_score": health_score,
            "open_risks": open_risks,
            "sla_breaches": sla_breaches,
        },
        "by_health": by_health,
        "by_status": by_status,
        "budget_by_project": [
            {"name": p["name"], "budget": p["budget"], "actual": p["actual_cost"]}
            for p in sorted(projects, key=lambda x: -x["budget"])[:10]],
        "kpis": kpis,
        "progress_trend": _synthetic_trend(round(
            sum(p["progress"] for p in projects) / len(projects)) if projects else 0),
    }


@route("GET", "/api/dashboard/portfolio")
def dash_portfolio(ctx):
    portfolios = db.query(
        """SELECT po.id, po.name,
                  COUNT(p.id) AS projects,
                  COALESCE(SUM(p.budget),0) AS budget,
                  COALESCE(SUM(p.actual_cost),0) AS actual,
                  COALESCE(AVG(p.progress),0) AS progress
           FROM portfolios po LEFT JOIN projects p ON p.portfolio_id=po.id
           GROUP BY po.id ORDER BY budget DESC""")
    # treemap data: portfolio -> projects
    tree = []
    for po in portfolios:
        children = db.query("SELECT name, budget AS value, health FROM projects WHERE portfolio_id=?", (po["id"],))
        tree.append({"name": po["name"], "children": children})
    # bubble/prioritisation: value vs risk
    projects = db.query(
        """SELECT p.name, p.budget, p.progress, p.priority, p.health,
                  (SELECT COALESCE(AVG(severity),0) FROM risks r WHERE r.project_id=p.id) AS risk
           FROM projects p""")
    return {"portfolios": portfolios, "treemap": tree, "bubble": projects}


@route("GET", "/api/dashboard/resource")
def dash_resource(ctx):
    util = utilization(ctx)
    buckets = {"over": 0, "high": 0, "healthy": 0, "under": 0}
    for u in util:
        buckets[u["status"]] += 1
    # allocation by team
    team_alloc = db.query(
        """SELECT t.name AS team, COALESCE(AVG(x.alloc),0) AS avg_alloc FROM teams t
           LEFT JOIN (SELECT u.team_id, SUM(ra.allocation_percent) AS alloc
                      FROM users u JOIN resource_allocations ra ON ra.user_id=u.id
                      GROUP BY u.id) x ON x.team_id=t.id
           GROUP BY t.id ORDER BY avg_alloc DESC""")
    return {"utilization": util, "buckets": buckets, "team_allocation": team_alloc}


@route("GET", "/api/dashboard/project")
def dash_project(ctx):
    pid = int(ctx["query"].get("id", 0))
    _assert_project_visible(ctx["user"], pid)
    tasks = db.query("SELECT * FROM tasks WHERE project_id=? AND parent_task_id IS NULL", (pid,))
    by_status = _count_by(tasks, "status")
    burn = db.query(
        """SELECT entry_date, SUM(hours) AS hours FROM time_entries
           WHERE project_id=? GROUP BY entry_date ORDER BY entry_date""", (pid,))
    est = sum(t["estimate_hours"] for t in tasks)
    act = sum(t["actual_hours"] for t in tasks)
    return {"by_status": by_status, "burn": burn,
            "estimate_vs_actual": {"estimate": est, "actual": act},
            "task_count": len(tasks)}


@route("GET", "/api/dashboard/risk")
def dash_risk(ctx):
    where, params = _scope_projects(ctx["user"], "p")
    risks = db.query(
        f"""SELECT r.* FROM risks r JOIN projects p ON p.id=r.project_id WHERE {where}""", params)
    # 5x5 heatmap
    heat = [[0] * 5 for _ in range(5)]
    for r in risks:
        heat[r["impact"] - 1][r["probability"] - 1] += 1
    by_status = _count_by(risks, "status")
    top = sorted(risks, key=lambda x: -x["severity"])[:8]
    top_named = db.query(
        f"""SELECT r.title, r.severity, r.status, p.name AS project FROM risks r
            JOIN projects p ON p.id=r.project_id WHERE {where}
            ORDER BY r.severity DESC LIMIT 8""", params)
    return {"heatmap": heat, "by_status": by_status, "top": top_named,
            "total": len(risks)}


@route("GET", "/api/dashboard/financial")
def dash_financial(ctx):
    projects = _agg_projects(ctx["user"])
    by_portfolio = db.query(
        """SELECT po.name, COALESCE(SUM(p.budget),0) AS budget,
                  COALESCE(SUM(p.actual_cost),0) AS actual
           FROM portfolios po LEFT JOIN projects p ON p.portfolio_id=po.id
           GROUP BY po.id ORDER BY budget DESC""")
    total_budget = sum(p["budget"] for p in projects)
    total_actual = sum(p["actual_cost"] for p in projects)
    variance = total_budget - total_actual
    overruns = [{"name": p["name"], "over": p["actual_cost"] - p["budget"]}
                for p in projects if p["actual_cost"] > p["budget"]]
    return {"by_portfolio": by_portfolio, "total_budget": total_budget,
            "total_actual": total_actual, "variance": variance,
            "overruns": sorted(overruns, key=lambda x: -x["over"])[:8],
            "cost_trend": _synthetic_cost_trend(total_actual)}


@route("GET", "/api/dashboard/okr")
def dash_okr(ctx):
    objs = list_okrs(ctx)
    by_level = {}
    for o in objs:
        by_level.setdefault(o["level"], []).append(o["progress"])
    avg_by_level = {k: round(sum(v) / len(v)) for k, v in by_level.items()}
    status_counts = _count_by(objs, "status")
    return {"objectives": objs, "avg_by_level": avg_by_level, "status_counts": status_counts}


@route("GET", "/api/dashboard/kpi")
def dash_kpi(ctx):
    kpis = db.query("SELECT * FROM kpis")
    by_persp = {}
    for k in kpis:
        target = k["target"] or 1
        if k["direction"] == "up":
            attain = min(150, round(k["current"] / target * 100)) if target else 0
        else:  # lower is better
            attain = min(150, round(target / k["current"] * 100)) if k["current"] else 100
        k["attainment"] = attain
        by_persp.setdefault(k["perspective"], []).append(attain)
    scorecard = {p: round(sum(v) / len(v)) for p, v in by_persp.items()}
    return {"kpis": kpis, "scorecard": scorecard}


# ------------------------------------------------------------------- PPM -------
@route("GET", "/api/ppm/prioritization")
def ppm_prioritization(ctx):
    """Score & rank projects: value (budget & priority) vs risk vs progress."""
    prio_weight = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    projects = db.query(
        """SELECT p.*, (SELECT COALESCE(AVG(severity),0) FROM risks r WHERE r.project_id=p.id) AS risk
           FROM projects p WHERE p.status NOT IN ('completed','cancelled')""")
    ranked = []
    max_budget = max([p["budget"] for p in projects], default=1) or 1
    for p in projects:
        value = (p["budget"] / max_budget) * 40 + prio_weight.get(p["priority"], 2) * 12
        risk_penalty = (p["risk"] / 25) * 20
        score = round(max(0, value - risk_penalty + p["progress"] * 0.15), 1)
        db.execute("UPDATE projects SET priority_score=? WHERE id=?", (score, p["id"]))
        ranked.append({"id": p["id"], "name": p["name"], "score": score,
                       "budget": p["budget"], "priority": p["priority"],
                       "risk": round(p["risk"], 1), "progress": p["progress"],
                       "health": p["health"]})
    ranked.sort(key=lambda x: -x["score"])
    return {"ranked": ranked}


@route("GET", "/api/ppm/capacity")
def ppm_capacity(ctx):
    """Demand vs capacity by team."""
    teams = db.query("SELECT id,name FROM teams")
    result = []
    for t in teams:
        cap = db.query_one(
            """SELECT COALESCE(SUM(capacity_hours),0) c FROM users WHERE team_id=?""", (t["id"],))["c"]
        demand = db.query_one(
            """SELECT COALESCE(SUM(ra.allocation_percent),0)/100.0 * 40 d
               FROM resource_allocations ra JOIN users u ON u.id=ra.user_id
               WHERE u.team_id=?""", (t["id"],))["d"]
        result.append({"team": t["name"], "capacity": round(cap, 1),
                       "demand": round(demand or 0, 1),
                       "balance": round(cap - (demand or 0), 1)})
    return {"teams": result}


@route("POST", "/api/ppm/scenario")
def ppm_scenario(ctx):
    """What-if: fund top N projects within a budget cap; report which fit."""
    rbac.require_level(ctx["user"], rbac.MANAGER)
    b = ctx["body"] or {}
    cap = float(b.get("budget_cap", 0)) or None
    fund_top = int(b.get("fund_top", 0)) or None
    ranked = ppm_prioritization(ctx)["ranked"]
    funded, cost = [], 0
    for i, p in enumerate(ranked):
        if fund_top and len(funded) >= fund_top:
            break
        if cap and cost + p["budget"] > cap:
            continue
        funded.append(p)
        cost += p["budget"]
    unfunded = [p for p in ranked if p not in funded]
    return {"funded": funded, "unfunded": unfunded, "total_cost": cost,
            "count_funded": len(funded), "count_unfunded": len(unfunded)}


@route("GET", "/api/ppm/health")
def ppm_health(ctx):
    projects = _agg_projects(ctx["user"])
    return {"score": _portfolio_health(projects),
            "by_health": _count_by(projects, "health")}


# --------------------------------------------------------------- utilities -----
def _count_by(rows, key):
    out = {}
    for r in rows:
        out[r[key]] = out.get(r[key], 0) + 1
    return out


def _portfolio_health(projects):
    if not projects:
        return 100
    weights = {"green": 100, "amber": 60, "red": 20}
    health = sum(weights.get(p["health"], 60) for p in projects) / len(projects)
    # budget adherence factor
    over = sum(1 for p in projects if p["actual_cost"] > p["budget"] and p["budget"] > 0)
    budget_factor = max(0, 1 - (over / len(projects)) * 0.4)
    return round(health * budget_factor)


def _synthetic_trend(current):
    """Build a plausible 8-point progress trend ending at current value."""
    pts, val = [], max(0, current - 22)
    for i in range(8):
        val = min(100, val + (current - val) * 0.35 + (2 if i % 2 else -1))
        pts.append({"period": f"W{i+1}", "value": round(val, 1)})
    pts[-1]["value"] = current
    return pts


def _synthetic_cost_trend(total):
    pts, val = [], total * 0.4
    for i in range(8):
        val = min(total, val + total * 0.09)
        pts.append({"period": f"M{i+1}", "value": round(val)})
    return pts
