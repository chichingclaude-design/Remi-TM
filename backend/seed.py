"""Seed the database with roles, permissions, sample users and a full dataset.

Idempotent: only runs when the users table is empty.
"""
import datetime
import random
from . import database as db
from . import auth

random.seed(42)
TODAY = datetime.date.today()


def d(offset_days):
    return (TODAY + datetime.timedelta(days=offset_days)).isoformat()


PERMISSIONS = [
    ("project.view", "View projects"), ("project.create", "Create projects"),
    ("project.edit", "Edit projects"), ("project.delete", "Delete projects"),
    ("task.view", "View tasks"), ("task.create", "Create tasks"),
    ("task.edit", "Edit tasks"), ("task.assign", "Assign tasks"),
    ("time.log", "Log time"), ("comment.create", "Comment"),
    ("risk.manage", "Manage risks"), ("okr.manage", "Manage OKRs"),
    ("kpi.manage", "Manage KPIs"), ("sla.manage", "Manage SLAs"),
    ("raci.manage", "Manage RACI"), ("workflow.manage", "Manage workflows"),
    ("portfolio.manage", "Manage portfolio"), ("resource.manage", "Manage resources"),
    ("user.manage", "Manage users"), ("audit.view", "View audit log"),
    ("backup.manage", "Backup & restore"),
]

# role name -> (level, description, permission codes)
ROLES = {
    "Director":   (100, "Full access to all modules and data", [p[0] for p in PERMISSIONS]),
    "Manager":    (70, "Owns destinations, projects and team", [
        "project.view", "project.create", "project.edit", "task.view", "task.create",
        "task.edit", "task.assign", "time.log", "comment.create", "risk.manage",
        "okr.manage", "kpi.manage", "sla.manage", "raci.manage", "workflow.manage",
        "resource.manage", "audit.view"]),
    "Specialist": (40, "Updates assigned tasks, comments and time", [
        "project.view", "task.view", "task.edit", "time.log", "comment.create"]),
    "Clerk":      (10, "Read-only access", [
        "project.view", "task.view"]),
}


def seed():
    if db.query_one("SELECT 1 FROM users LIMIT 1"):
        return False  # already seeded

    # ---- permissions & roles ----
    for code, desc in PERMISSIONS:
        db.execute("INSERT INTO permissions (code, description) VALUES (?,?)", (code, desc))
    role_ids = {}
    for name, (level, desc, perms) in ROLES.items():
        rid = db.execute("INSERT INTO roles (name, level, description) VALUES (?,?,?)",
                         (name, level, desc))
        role_ids[name] = rid
        for code in perms:
            pid = db.query_one("SELECT id FROM permissions WHERE code=?", (code,))["id"]
            db.execute("INSERT INTO role_permissions (role_id, permission_id) VALUES (?,?)",
                       (rid, pid))

    # ---- destinations ----
    dests = [("North Region", "North"), ("Coastal Region", "Coast"),
             ("Capital HQ", "Central"), ("Island Cluster", "Islands")]
    dest_ids = [db.execute(
        "INSERT INTO destinations (name, region, description) VALUES (?,?,?)",
        (n, r, f"Business unit for the {n}")) for n, r in dests]

    # ---- teams ----
    teams = [("Delivery", "PMO"), ("Engineering", "Technology"),
             ("Design", "Product"), ("Operations", "Operations"),
             ("Finance", "Finance"), ("Marketing", "Growth")]
    team_ids = [db.execute(
        "INSERT INTO teams (name, department, description) VALUES (?,?,?)",
        (n, dep, f"{n} team")) for n, dep in teams]

    # ---- users ----
    colors = ["#2563eb", "#0ea5e9", "#16a34a", "#7c3aed", "#dc2626",
              "#d97706", "#0891b2", "#4338ca", "#059669", "#db2777"]

    def make_user(username, full, role, team, dest, title, cap=40, locale="en"):
        h, salt = auth.hash_password(username + "123")  # e.g. director123
        return db.execute(
            """INSERT INTO users
               (username,email,full_name,password_hash,salt,role_id,team_id,
                destination_id,job_title,capacity_hours,avatar_color,locale)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (username, f"{username}@ppm.local", full, h, salt, role_ids[role],
             team, dest, title, cap, random.choice(colors), locale))

    users = {}
    users["director"] = make_user("director", "Ana Direktor", "Director",
                                   team_ids[0], dest_ids[2], "Portfolio Director", 40, "hr")
    users["manager"] = make_user("manager", "Marko Manager", "Manager",
                                 team_ids[0], dest_ids[0], "Delivery Manager")
    users["manager2"] = make_user("manager2", "Petra Voditelj", "Manager",
                                  team_ids[1], dest_ids[1], "Engineering Manager", 40, "hr")
    users["specialist"] = make_user("specialist", "Ivan Specijalist", "Specialist",
                                    team_ids[1], dest_ids[0], "Senior Engineer")
    users["clerk"] = make_user("clerk", "Sara Referent", "Clerk",
                               team_ids[3], dest_ids[2], "Operations Clerk", 40, "hr")
    # a bench of specialists for resource charts
    names = ["Luka Kovač", "Maja Novak", "Josip Horvat", "Ela Marić", "Ante Babić",
             "Nina Jurić", "Filip Vuković", "Dora Knežević", "Tin Pavlić", "Lea Šimić"]
    for i, nm in enumerate(names):
        uname = f"spec{i+1}"
        users[uname] = make_user(uname, nm, "Specialist",
                                 team_ids[i % len(team_ids)],
                                 dest_ids[i % len(dest_ids)], "Specialist",
                                 cap=random.choice([32, 40, 40, 40]))

    all_specialists = [v for k, v in users.items() if k.startswith("spec")]
    # set managers on teams / destinations
    db.execute("UPDATE teams SET manager_id=? WHERE id=?", (users["manager"], team_ids[0]))
    db.execute("UPDATE teams SET manager_id=? WHERE id=?", (users["manager2"], team_ids[1]))
    db.execute("UPDATE destinations SET manager_id=? WHERE id=?", (users["manager"], dest_ids[0]))
    db.execute("UPDATE destinations SET manager_id=? WHERE id=?", (users["manager2"], dest_ids[1]))

    # ---- skills ----
    skills = [("Python", "Engineering"), ("JavaScript", "Engineering"),
              ("UX Design", "Design"), ("Data Analysis", "Analytics"),
              ("Project Management", "PMO"), ("Financial Modelling", "Finance"),
              ("DevOps", "Engineering"), ("Copywriting", "Marketing")]
    skill_ids = [db.execute("INSERT INTO skills (name, category) VALUES (?,?)", s) for s in skills]
    for uid in all_specialists + [users["specialist"]]:
        for sid in random.sample(skill_ids, random.randint(2, 4)):
            db.execute("INSERT INTO user_skills (user_id, skill_id, level) VALUES (?,?,?)",
                       (uid, sid, random.randint(2, 5)))

    # ---- portfolios / programs ----
    portfolios = [
        ("Digital Transformation", "Modernize core platforms", "Grow digital revenue 30%"),
        ("Customer Experience", "Improve NPS and retention", "Raise NPS to 60"),
        ("Operational Excellence", "Cut operating cost", "Reduce opex by 12%"),
    ]
    port_ids = [db.execute(
        "INSERT INTO portfolios (name, description, strategic_goal, owner_id) VALUES (?,?,?,?)",
        (n, desc, goal, users["director"])) for n, desc, goal in portfolios]

    programs = [("Cloud Migration", port_ids[0]), ("Mobile App", port_ids[0]),
                ("Loyalty Revamp", port_ids[1]), ("Support Automation", port_ids[1]),
                ("Process Reengineering", port_ids[2])]
    prog_ids = [db.execute(
        "INSERT INTO programs (portfolio_id, name, manager_id) VALUES (?,?,?)",
        (pid, nm, random.choice([users["manager"], users["manager2"]])))
        for nm, pid in programs]

    # ---- projects ----
    proj_names = [
        "ERP Upgrade", "Data Lake Build", "Mobile Booking App", "Loyalty Portal",
        "Contact Center AI", "Warehouse Automation", "Website Redesign",
        "Billing Consolidation", "Security Hardening", "BI Platform",
        "HR Self-Service", "Payment Gateway", "IoT Monitoring", "Partner API",
    ]
    statuses = ["planning", "active", "active", "active", "on_hold", "completed"]
    prios = ["low", "medium", "high", "high", "critical"]
    healths = ["green", "green", "amber", "red"]
    gates = ["G0", "G1", "G2", "G3", "G4", "G5"]
    project_ids = []
    for i, nm in enumerate(proj_names):
        budget = random.choice([120, 250, 400, 600, 900]) * 1000
        status = random.choice(statuses)
        progress = 100 if status == "completed" else random.randint(5, 92)
        actual = round(budget * (progress / 100) * random.uniform(0.7, 1.25))
        start_off = -random.randint(30, 180)
        pid = db.execute(
            """INSERT INTO projects
               (code,portfolio_id,program_id,destination_id,name,description,manager_id,
                status,priority,health,stage_gate,start_date,end_date,budget,actual_cost,progress)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (f"PRJ-{100+i}", random.choice(port_ids), random.choice(prog_ids),
             random.choice(dest_ids), nm, f"{nm} delivery project",
             random.choice([users["manager"], users["manager2"]]),
             status, random.choice(prios), random.choice(healths),
             random.choice(gates), d(start_off), d(start_off + random.randint(90, 300)),
             budget, actual, progress))
        project_ids.append(pid)

        # milestones
        for m in range(random.randint(2, 4)):
            db.execute(
                "INSERT INTO milestones (project_id,name,due_date,status) VALUES (?,?,?,?)",
                (pid, f"Milestone {m+1}", d(start_off + 40 * (m + 1)),
                 random.choice(["open", "done", "open"])))
        # stage gates
        for g in gates:
            st = "passed" if g <= random.choice(gates) else "pending"
            db.execute("INSERT INTO stage_gates (project_id, gate, status) VALUES (?,?,?)",
                       (pid, g, st))
        # risks
        for r in range(random.randint(1, 4)):
            prob, imp = random.randint(1, 5), random.randint(1, 5)
            db.execute(
                """INSERT INTO risks (project_id,title,description,probability,impact,severity,
                   status,owner_id,mitigation) VALUES (?,?,?,?,?,?,?,?,?)""",
                (pid, random.choice([
                    "Vendor delay", "Scope creep", "Budget overrun", "Key person risk",
                    "Integration failure", "Regulatory change", "Data quality issue"]),
                 "Identified during planning", prob, imp, prob * imp,
                 random.choice(["open", "mitigating", "closed"]),
                 random.choice(all_specialists), "Mitigation plan in progress"))
        # issues & changes
        for _ in range(random.randint(0, 2)):
            db.execute("INSERT INTO issues (project_id,title,severity,status,owner_id) VALUES (?,?,?,?,?)",
                       (pid, "Environment instability", random.choice(["low", "medium", "high"]),
                        "open", random.choice(all_specialists)))
        for _ in range(random.randint(0, 2)):
            db.execute("INSERT INTO changes (project_id,title,impact,status,requested_by) VALUES (?,?,?,?,?)",
                       (pid, "Additional reporting requirement", random.choice(["low", "medium", "high"]),
                        random.choice(["requested", "approved", "implemented"]), users["manager"]))
        # resource allocations
        for uid in random.sample(all_specialists, random.randint(2, 5)):
            db.execute(
                "INSERT INTO resource_allocations (user_id,project_id,allocation_percent,start_date,end_date) VALUES (?,?,?,?,?)",
                (uid, pid, random.choice([20, 30, 40, 50, 60, 80]), d(start_off), d(start_off + 120)))

    # ---- project dependencies ----
    for _ in range(6):
        a, b = random.sample(project_ids, 2)
        db.execute("INSERT INTO project_dependencies (project_id, depends_on_id, type) VALUES (?,?,?)",
                   (a, b, "FS"))

    # ---- tasks & subtasks & checklists & time ----
    task_titles = ["Requirements workshop", "Design review", "Build API", "Write tests",
                   "Data migration", "UAT prep", "Deploy to staging", "Security scan",
                   "Documentation", "Stakeholder demo", "Performance tuning", "Bug triage"]
    tstatus = ["todo", "in_progress", "review", "blocked", "done"]
    for pid in project_ids:
        n_tasks = random.randint(5, 10)
        for _ in range(n_tasks):
            assignee = random.choice(all_specialists + [users["specialist"]])
            est = random.choice([4, 8, 16, 24, 40])
            status = random.choice(tstatus)
            actual = round(est * random.uniform(0.4, 1.4)) if status != "todo" else 0
            prog = 100 if status == "done" else (random.randint(10, 80) if status != "todo" else 0)
            start_off = -random.randint(0, 60)
            tid = db.execute(
                """INSERT INTO tasks
                   (project_id,title,description,status,priority,assignee_id,reporter_id,
                    estimate_hours,actual_hours,start_date,due_date,progress,order_index)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (pid, random.choice(task_titles), "Task detail here", status,
                 random.choice(prios), assignee, users["manager"], est, actual,
                 d(start_off), d(start_off + random.randint(3, 20)), prog,
                 random.randint(0, 100)))
            # checklists
            for c in range(random.randint(0, 3)):
                db.execute("INSERT INTO checklists (task_id,text,is_done,order_index) VALUES (?,?,?,?)",
                           (tid, f"Step {c+1}", random.choice([0, 1]), c))
            # subtasks
            for s in range(random.randint(0, 2)):
                db.execute(
                    """INSERT INTO tasks (project_id,parent_task_id,title,status,priority,assignee_id,estimate_hours)
                       VALUES (?,?,?,?,?,?,?)""",
                    (pid, tid, f"Subtask {s+1}", random.choice(tstatus), "medium", assignee, 4))
            # time entries
            for _ in range(random.randint(0, 3)):
                db.execute("INSERT INTO time_entries (task_id,project_id,user_id,hours,entry_date,note) VALUES (?,?,?,?,?,?)",
                           (tid, pid, assignee, random.choice([1, 2, 4, 6, 8]),
                            d(-random.randint(0, 21)), "Work logged"))
            # a couple of comments
            if random.random() < 0.4:
                db.execute("INSERT INTO comments (entity_type,entity_id,user_id,body) VALUES (?,?,?,?)",
                           ("task", tid, users["manager"], "Please prioritise this."))

    # ---- workflows ----
    wf = db.execute("INSERT INTO workflows (name, entity_type, description) VALUES (?,?,?)",
                    ("Default Task Workflow", "task", "Standard delivery workflow"))
    states = [("Backlog", "#94a3b8", 1, 0), ("To Do", "#64748b", 0, 0),
              ("In Progress", "#2563eb", 0, 0), ("Review", "#d97706", 0, 0),
              ("Done", "#16a34a", 0, 1)]
    state_ids = []
    for nm, color, is_init, is_final in states:
        sid = db.execute(
            "INSERT INTO workflow_states (workflow_id,name,color,order_index,is_initial,is_final) VALUES (?,?,?,?,?,?)",
            (wf, nm, color, len(state_ids), is_init, is_final))
        state_ids.append(sid)
    for i in range(len(state_ids) - 1):
        db.execute("INSERT INTO workflow_transitions (workflow_id,from_state_id,to_state_id,name,requires_approval) VALUES (?,?,?,?,?)",
                   (wf, state_ids[i], state_ids[i + 1], "Advance", 1 if i == 3 else 0))

    # approval workflow example
    apwf = db.execute("INSERT INTO workflows (name, entity_type, description) VALUES (?,?,?)",
                      ("Budget Change Approval", "change", "Two-step approval for budget changes"))

    db.execute("""INSERT INTO automations (name,trigger_type,condition_json,action_json)
                  VALUES (?,?,?,?)""",
               ("Notify on blocked", "status_change", '{"to":"blocked"}',
                '{"notify":"manager","message":"A task was blocked"}'))
    db.execute("""INSERT INTO automations (name,trigger_type,condition_json,action_json)
                  VALUES (?,?,?,?)""",
               ("Escalate overdue", "due_soon", '{"days":0}',
                '{"escalate":true,"message":"Task overdue"}'))

    # approvals
    for _ in range(4):
        db.execute("""INSERT INTO approvals (entity_type,entity_id,title,requested_by,approver_id,status)
                      VALUES (?,?,?,?,?,?)""",
                   ("change", random.choice(project_ids), "Budget increase request",
                    users["manager"], users["director"],
                    random.choice(["pending", "approved", "rejected"])))

    # ---- OKRs ----
    company_obj = db.execute(
        """INSERT INTO objectives (level,title,description,owner_id,period,progress,status)
           VALUES (?,?,?,?,?,?,?)""",
        ("company", "Become the market leader in digital services",
         "Company annual objective", users["director"], f"{TODAY.year}-Q3", 58, "on_track"))
    for kr in [("Grow ARR to €10M", 10, 6.2, "€M"),
               ("Reach NPS of 60", 60, 47, "pts"),
               ("Launch 3 new products", 3, 2, "count")]:
        prog = round(min(100, kr[2] / kr[1] * 100))
        db.execute("""INSERT INTO key_results (objective_id,title,target,current,unit,progress,status)
                      VALUES (?,?,?,?,?,?,?)""",
                   (company_obj, kr[0], kr[1], kr[2], kr[3], prog,
                    "on_track" if prog >= 60 else "at_risk"))

    dept_objs = []
    for dept, owner in [("Engineering excellence", users["manager2"]),
                        ("Flawless delivery", users["manager"])]:
        oid = db.execute("""INSERT INTO objectives (parent_id,level,title,owner_id,period,progress,status)
                            VALUES (?,?,?,?,?,?,?)""",
                         (company_obj, "department", dept, owner, f"{TODAY.year}-Q3",
                          random.randint(30, 80), random.choice(["on_track", "at_risk"])))
        dept_objs.append(oid)
        for kr in [("Reduce lead time", 100, random.randint(40, 90), "%"),
                   ("Automate CI coverage", 100, random.randint(50, 95), "%")]:
            db.execute("""INSERT INTO key_results (objective_id,title,target,current,unit,progress,status)
                          VALUES (?,?,?,?,?,?,?)""",
                       (oid, kr[0], kr[1], kr[2], kr[3], kr[2], "on_track"))

    # ---- KPIs (balanced scorecard) ----
    kpis = [
        ("Revenue", "financial", "€M", 12, 8.4, "up"),
        ("Gross Margin", "financial", "%", 45, 41, "up"),
        ("Budget Variance", "financial", "%", 0, -6, "down"),
        ("Customer Satisfaction", "customer", "pts", 90, 82, "up"),
        ("Net Promoter Score", "customer", "pts", 60, 47, "up"),
        ("Churn Rate", "customer", "%", 5, 7.2, "down"),
        ("On-time Delivery", "internal", "%", 95, 88, "up"),
        ("Defect Density", "internal", "/kloc", 1, 1.6, "down"),
        ("Cycle Time", "internal", "days", 10, 13, "down"),
        ("Employee Engagement", "learning", "%", 85, 79, "up"),
        ("Training Hours", "learning", "hrs", 40, 28, "up"),
        ("Skill Coverage", "learning", "%", 90, 74, "up"),
    ]
    for nm, persp, unit, target, current, direction in kpis:
        kid = db.execute("""INSERT INTO kpis (name,category,perspective,owner_id,target,current,unit,direction,period)
                            VALUES (?,?,?,?,?,?,?,?,?)""",
                         (nm, persp, persp, users["director"], target, current, unit,
                          direction, f"{TODAY.year}-Q3"))
        val = current
        for w in range(8, 0, -1):
            val = round(val * random.uniform(0.95, 1.03), 2)
            db.execute("INSERT INTO kpi_history (kpi_id,value,recorded_at) VALUES (?,?,?)",
                       (kid, val, d(-7 * w)))

    # ---- SLA ----
    policies = [("Critical incident", "critical", 15, 240),
                ("High priority", "high", 60, 480),
                ("Standard request", "medium", 240, 1440),
                ("Low priority", "low", 480, 2880)]
    policy_ids = [db.execute("""INSERT INTO sla_policies (name,priority,response_minutes,resolution_minutes,description)
                                VALUES (?,?,?,?,?)""",
                             (n, p, rt, rs, f"{n} SLA policy")) for n, p, rt, rs in policies]
    ticket_titles = ["Login outage", "Report not generating", "Data sync failing",
                     "Slow dashboard", "Access request", "Integration error",
                     "Payment declined", "Email delay"]
    for i in range(20):
        pol = random.choice(list(zip(policy_ids, policies)))
        pol_id, (_, prio, rt, rs) = pol
        created = datetime.datetime.now() - datetime.timedelta(hours=random.randint(1, 200))
        resp_due = created + datetime.timedelta(minutes=rt)
        reso_due = created + datetime.timedelta(minutes=rs)
        status = random.choice(["open", "responded", "resolved", "resolved", "closed"])
        first_resp = created + datetime.timedelta(minutes=random.randint(5, rt + 120)) \
            if status != "open" else None
        resolved = created + datetime.timedelta(minutes=random.randint(rt, rs + 600)) \
            if status in ("resolved", "closed") else None
        br_resp = 1 if (first_resp and first_resp > resp_due) else 0
        br_reso = 1 if (resolved and resolved > reso_due) else 0
        db.execute("""INSERT INTO sla_tickets
            (title,priority,policy_id,project_id,assignee_id,status,created_at,response_due,
             resolution_due,first_response_at,resolved_at,breached_response,breached_resolution)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                   (random.choice(ticket_titles), prio, pol_id, random.choice(project_ids),
                    random.choice(all_specialists), status, created.isoformat(),
                    resp_due.isoformat(), reso_due.isoformat(),
                    first_resp.isoformat() if first_resp else None,
                    resolved.isoformat() if resolved else None, br_resp, br_reso))

    # ---- RACI ----
    for pid in project_ids[:4]:
        mid = db.execute("INSERT INTO raci_matrices (project_id,name,description) VALUES (?,?,?)",
                         (pid, "Delivery RACI", "Responsibility matrix for delivery"))
        members = random.sample(all_specialists + [users["manager"], users["specialist"]], 5)
        activities = ["Requirements", "Design", "Development", "Testing", "Deployment", "Signoff"]
        for a_i, act in enumerate(activities):
            aid = db.execute("INSERT INTO raci_activities (matrix_id,name,order_index) VALUES (?,?,?)",
                             (mid, act, a_i))
            # exactly one Accountable, at least one Responsible
            letters = ["A"] + ["R"] * random.randint(1, 2) + \
                      random.sample(["C", "I", "C", "I"], random.randint(1, 2))
            random.shuffle(members)
            for u_i, uid in enumerate(members[:len(letters)]):
                db.execute("INSERT INTO raci_assignments (activity_id,user_id,letter) VALUES (?,?,?)",
                           (aid, uid, letters[u_i]))

    # ---- scenarios ----
    db.execute("""INSERT INTO scenarios (name,description,definition_json,created_by)
                  VALUES (?,?,?,?)""",
               ("Aggressive delivery", "Fund top 6 projects only",
                '{"fund_top":6,"capacity_cap":100}', users["director"]))

    # ---- notifications & audit ----
    for uid in [users["director"], users["manager"], users["specialist"]]:
        audit_notify(uid)
    from . import audit
    audit.log({"id": users["director"]}, "seed", "system", None, "Initial data seeded")

    # ---- settings ----
    for k, v in [("company_name", "Acme Enterprise"), ("default_locale", "en"),
                 ("currency", "EUR"), ("fiscal_year_start", "01-01")]:
        db.execute("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)", (k, v))

    db.get_conn().commit()
    return True


def audit_notify(uid):
    db.execute("""INSERT INTO notifications (user_id,type,title,body) VALUES (?,?,?,?)""",
               (uid, "info", "Welcome to the PPM platform",
                "Your workspace has been initialised with sample data."))
    db.execute("""INSERT INTO notifications (user_id,type,title,body) VALUES (?,?,?,?)""",
               (uid, "warning", "3 SLA tickets near breach",
                "Review the SLA dashboard for details."))
