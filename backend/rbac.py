"""Role-based access control.

Four roles, by descending authority:
  Director   (level 100) : full access to everything.
  Manager    (level  70) : own destination / projects / team.
  Specialist (level  40) : update assigned tasks, comments, time.
  Clerk      (level  10) : read-only.
"""

DIRECTOR = 100
MANAGER = 70
SPECIALIST = 40
CLERK = 10


class Forbidden(Exception):
    pass


def require_level(user, level):
    if not user or user["role_level"] < level:
        raise Forbidden("Insufficient permissions")


def can_write(user):
    """Clerks are read-only."""
    return user and user["role_level"] > CLERK


def require_write(user):
    if not can_write(user):
        raise Forbidden("This account is read-only")


def is_director(user):
    return user and user["role_level"] >= DIRECTOR


def is_manager(user):
    return user and user["role_level"] >= MANAGER


def has_permission(user, code):
    if not user:
        return False
    if user["role_level"] >= DIRECTOR:
        return True
    from . import database as db
    row = db.query_one(
        """SELECT 1 FROM role_permissions rp
           JOIN permissions p ON p.id = rp.permission_id
           WHERE rp.role_id = ? AND p.code = ?""",
        (user["role_id"], code))
    return row is not None


def visible_project_ids(user):
    """Project ids a user may see.

    Director  -> all
    Manager   -> projects they manage OR in their destination OR their team's work
    Specialist/Clerk -> projects where they have tasks or allocations
    """
    from . import database as db
    if is_director(user):
        return None  # None == unrestricted
    if user["role_level"] == CLERK:
        return None  # read-only oversight role: sees everything, edits nothing
    if is_manager(user):
        rows = db.query(
            """SELECT DISTINCT id FROM projects
               WHERE manager_id = ?
                  OR destination_id = (SELECT destination_id FROM users WHERE id = ?)""",
            (user["id"], user["id"]))
        return {r["id"] for r in rows}
    rows = db.query(
        """SELECT DISTINCT project_id AS id FROM tasks WHERE assignee_id = ?
           UNION SELECT project_id AS id FROM resource_allocations WHERE user_id = ?
           UNION SELECT project_id AS id FROM time_entries WHERE user_id = ?""",
        (user["id"], user["id"], user["id"]))
    return {r["id"] for r in rows if r["id"] is not None}


def can_edit_task(user, task):
    if is_manager(user):
        return True
    if user["role_level"] >= SPECIALIST and task.get("assignee_id") == user["id"]:
        return True
    return False
