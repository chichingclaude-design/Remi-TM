"""SQLite access layer: auto-creates the DB on first launch, provides helpers."""
import os
import sqlite3
import shutil
import datetime
import threading
from . import config

_local = threading.local()


def get_conn():
    """Thread-local connection. Row access by column name."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(config.DB_PATH, check_same_thread=False,
                               timeout=config.DB_BUSY_TIMEOUT_MS / 1000.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        # Concurrency: wait (don't error) when another writer holds the lock.
        conn.execute(f"PRAGMA busy_timeout = {config.DB_BUSY_TIMEOUT_MS}")
        # WAL gives readers/writer concurrency for the single host process. On a
        # network share it can be forced to a portable rollback journal instead.
        conn.execute(f"PRAGMA journal_mode = {config.DB_JOURNAL_MODE}")
        conn.execute("PRAGMA synchronous = NORMAL")
        _local.conn = conn
    return conn


def db_exists_and_seeded():
    if not os.path.exists(config.DB_PATH):
        return False
    try:
        conn = get_conn()
        cur = conn.execute("SELECT COUNT(*) AS c FROM users")
        return cur.fetchone()["c"] > 0
    except sqlite3.Error:
        return False


def init_schema():
    """Create every table if it does not already exist."""
    conn = get_conn()
    with open(config.SCHEMA_PATH, "r", encoding="utf-8") as fh:
        conn.executescript(fh.read())
    conn.commit()


# ---- tiny query helpers -----------------------------------------------------
def query(sql, params=()):
    return [dict(r) for r in get_conn().execute(sql, params).fetchall()]


def query_one(sql, params=()):
    row = get_conn().execute(sql, params).fetchone()
    return dict(row) if row else None


def execute(sql, params=()):
    conn = get_conn()
    cur = conn.execute(sql, params)
    conn.commit()
    return cur.lastrowid


def executemany(sql, seq):
    conn = get_conn()
    conn.executemany(sql, seq)
    conn.commit()


# ---- backup / restore -------------------------------------------------------
def backup_db():
    """Create a timestamped copy of the database file."""
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    target = os.path.join(config.BACKUP_DIR, f"ppm_{ts}.db")
    get_conn().commit()
    shutil.copy2(config.DB_PATH, target)
    return target


def list_backups():
    if not os.path.isdir(config.BACKUP_DIR):
        return []
    files = []
    for name in sorted(os.listdir(config.BACKUP_DIR), reverse=True):
        path = os.path.join(config.BACKUP_DIR, name)
        if os.path.isfile(path):
            files.append({"name": name, "size": os.path.getsize(path),
                          "created": datetime.datetime.fromtimestamp(
                              os.path.getmtime(path)).isoformat(timespec="seconds")})
    return files


def restore_db(name):
    src = os.path.join(config.BACKUP_DIR, os.path.basename(name))
    if not os.path.isfile(src):
        raise FileNotFoundError(name)
    # close current connection so the file can be overwritten
    conn = getattr(_local, "conn", None)
    if conn:
        conn.close()
        _local.conn = None
    shutil.copy2(src, config.DB_PATH)
    return True
