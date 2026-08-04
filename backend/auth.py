"""Password hashing (PBKDF2-HMAC-SHA256), session tokens, user resolution."""
import hashlib
import hmac
import secrets
import string
import datetime
from . import database as db
from . import config

# Password policy: >= 12 chars, at least one upper, lower, digit and special char.
PASSWORD_MIN_LENGTH = 12
_SPECIALS = set("!@#$%^&*()-_=+[]{};:,.<>?/|\\`~\"'")


def validate_password(password):
    """Return None if the password satisfies the policy, else an error string."""
    if not password or len(password) < PASSWORD_MIN_LENGTH:
        return f"Password must be at least {PASSWORD_MIN_LENGTH} characters long"
    if not any(c.isupper() for c in password):
        return "Password must contain an uppercase letter"
    if not any(c.islower() for c in password):
        return "Password must contain a lowercase letter"
    if not any(c.isdigit() for c in password):
        return "Password must contain a number"
    if not any(c in _SPECIALS for c in password):
        return "Password must contain a special character"
    return None


def hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"),
                             salt.encode("utf-8"), config.PBKDF2_ITERATIONS)
    return dk.hex(), salt


def verify_password(password, stored_hash, salt):
    calc, _ = hash_password(password, salt)
    return hmac.compare_digest(calc, stored_hash)


def create_session(user_id):
    token = secrets.token_urlsafe(32)
    expires = (datetime.datetime.now()
               + datetime.timedelta(hours=config.SESSION_TTL_HOURS)).isoformat()
    db.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)",
               (token, user_id, expires))
    return token


def destroy_session(token):
    db.execute("DELETE FROM sessions WHERE token = ?", (token,))


def user_from_token(token):
    if not token:
        return None
    row = db.query_one(
        """SELECT s.expires_at, u.* , r.name AS role_name, r.level AS role_level,
                  t.name AS team_name, d.name AS destination_name
           FROM sessions s
           JOIN users u ON u.id = s.user_id
           JOIN roles r ON r.id = u.role_id
           LEFT JOIN teams t ON t.id = u.team_id
           LEFT JOIN destinations d ON d.id = u.destination_id
           WHERE s.token = ?""", (token,))
    if not row:
        return None
    if row["expires_at"] < datetime.datetime.now().isoformat():
        db.execute("DELETE FROM sessions WHERE token = ?", (token,))
        return None
    row.pop("password_hash", None)
    row.pop("salt", None)
    row.pop("expires_at", None)
    return row


def authenticate(username, password):
    u = db.query_one("SELECT * FROM users WHERE username = ? AND is_active = 1",
                     (username,))
    if not u or not verify_password(password, u["password_hash"], u["salt"]):
        return None
    return u
