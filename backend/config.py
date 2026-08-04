"""Central configuration for the PPM platform."""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# The database and runtime files can be redirected to a local disk (recommended
# when the app itself lives on a shared network folder) via PPM_DATA_DIR.
DATA_DIR = os.environ.get("PPM_DATA_DIR") or os.path.join(BASE_DIR, "data")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
DB_PATH = os.path.join(DATA_DIR, "ppm.db")
SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
LOCK_PATH = os.path.join(DATA_DIR, "server.lock")

# Multi-user: by default the host binds to all interfaces so teammates on the
# same network can connect. Set PPM_HOST=127.0.0.1 to restrict to this machine.
HOST = os.environ.get("PPM_HOST", "0.0.0.0")
# Cloud platforms (Render, Cloud Run, Railway, Heroku, ...) inject the port to
# listen on via $PORT. Honor it, then our own PPM_PORT, then a sensible default.
PORT = int(os.environ.get("PPM_PORT") or os.environ.get("PORT") or "8000")

# When true (default), a launch will not start a second server if another
# instance is already hosting the shared database — it opens that one instead.
SHARED_MODE = os.environ.get("PPM_SHARED", "1") != "0"

# SQLite concurrency tuning. On a network share, set PPM_JOURNAL=TRUNCATE for the
# most portable locking (WAL is ideal for a single host process on local disk).
DB_BUSY_TIMEOUT_MS = int(os.environ.get("PPM_BUSY_TIMEOUT_MS", "8000"))
DB_JOURNAL_MODE = os.environ.get("PPM_JOURNAL", "WAL").upper()

SESSION_TTL_HOURS = 12
PBKDF2_ITERATIONS = 120_000

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
