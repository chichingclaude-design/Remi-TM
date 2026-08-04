"""
Multi-user coordination for the shared-folder deployment.

Goal: the folder (and database) may sit on a shared drive that several people open
by double-clicking. We must NOT end up with many server processes all writing the
same SQLite file over the network (that risks corruption). Instead we elect ONE
host: the first launch becomes the server; every later launch detects the running
host and simply opens the browser to it.

Coordination uses an atomic lock file in the data directory containing the host's
URL and a heartbeat timestamp. A stale lock (host crashed / powered off) is
detected and taken over automatically.
"""
import os
import json
import time
import socket
import threading

from . import config

HEARTBEAT_INTERVAL = 5      # seconds between heartbeat writes
STALE_AFTER = 20            # a lock older than this (and unreachable) is stale


def lan_ip():
    """Best-effort LAN IP of this machine (works offline; sends no packets)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # only selects the outbound interface
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def _port_open(host, port, timeout=1.0):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        return s.connect_ex((host, int(port))) == 0
    except Exception:
        return False
    finally:
        s.close()


def _read_lock():
    try:
        with open(config.LOCK_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return None


def _lock_is_live(info):
    """A lock is live if its heartbeat is recent AND its port answers."""
    if not info:
        return False
    fresh = (time.time() - info.get("heartbeat", 0)) < STALE_AFTER
    reachable = _port_open(info.get("host_ip", "127.0.0.1"), info.get("port", config.PORT))
    return fresh and reachable


def _write_lock_atomic(info):
    """Create the lock file atomically. Returns True if we won the election."""
    tmp = config.LOCK_PATH + f".{os.getpid()}.tmp"
    try:
        fd = os.open(config.LOCK_PATH, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        return False
    except Exception:
        return False
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(info, f)
    except Exception:
        try:
            os.remove(config.LOCK_PATH)
        except Exception:
            pass
        return False
    return True


def acquire_or_locate():
    """
    Decide this process's role.

    Returns ("host", info) if this process should run the server, or
    ("client", url) if another instance is already hosting and we should just
    open the browser to it.
    """
    if not config.SHARED_MODE:
        info = {"host_ip": lan_ip(), "port": config.PORT, "pid": os.getpid(),
                "heartbeat": time.time(), "url": f"http://127.0.0.1:{config.PORT}"}
        return ("host", info)

    for _ in range(3):
        existing = _read_lock()
        if _lock_is_live(existing):
            ip = existing.get("host_ip", "127.0.0.1")
            return ("client", f"http://{ip}:{existing.get('port', config.PORT)}")

        # Stale or missing lock: try to clear a stale one, then claim it.
        if existing is not None:
            try:
                os.remove(config.LOCK_PATH)
            except Exception:
                pass

        info = {"host_ip": lan_ip(), "port": config.PORT, "pid": os.getpid(),
                "heartbeat": time.time()}
        info["url"] = f"http://{info['host_ip']}:{config.PORT}"
        if _write_lock_atomic(info):
            return ("host", info)
        time.sleep(0.4)  # lost a race; re-check who won

    # Could not acquire and could not confirm a live host — fall back to hosting
    # locally so the user is never left with nothing.
    info = {"host_ip": lan_ip(), "port": config.PORT, "pid": os.getpid(),
            "heartbeat": time.time()}
    info["url"] = f"http://{info['host_ip']}:{config.PORT}"
    return ("host", info)


def start_heartbeat(info):
    """Keep the lock fresh while we are the host; clean it up on exit."""
    stop = threading.Event()

    def beat():
        while not stop.is_set():
            info["heartbeat"] = time.time()
            try:
                with open(config.LOCK_PATH, "w") as f:
                    json.dump(info, f)
            except Exception:
                pass
            stop.wait(HEARTBEAT_INTERVAL)

    t = threading.Thread(target=beat, daemon=True)
    t.start()
    return stop


def release():
    """Remove our lock file if it is ours."""
    info = _read_lock()
    if info and info.get("pid") == os.getpid():
        try:
            os.remove(config.LOCK_PATH)
        except Exception:
            pass
