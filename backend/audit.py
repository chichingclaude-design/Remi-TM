"""Audit-log helper. Every mutating action should call log()."""
from . import database as db


def log(user, action, entity_type=None, entity_id=None, details=None, ip=None):
    uid = user["id"] if user else None
    db.execute(
        """INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip)
           VALUES (?,?,?,?,?,?)""",
        (uid, action, entity_type, entity_id, details, ip))


def notify(user_id, title, body="", ntype="info", link=None):
    db.execute(
        """INSERT INTO notifications (user_id, type, title, body, link)
           VALUES (?,?,?,?,?)""",
        (user_id, ntype, title, body, link))
