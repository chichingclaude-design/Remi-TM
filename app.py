#!/usr/bin/env python3
"""Enterprise PPM Platform - single entry point.

Behaviour when you launch (double-click or `python app.py`):

  * If no one is already running the shared database, THIS launch becomes the
    host: it creates/opens the database, starts the web server on the local
    network, and opens your browser.
  * If a teammate is already hosting the shared database, this launch does NOT
    start a second server (that would risk database corruption); it simply opens
    your browser to the running host.

The database is created once, on the very first launch, and its data is preserved
across restarts. No internet is required.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend import database, server, cluster, config
from backend.seed import seed


def bootstrap():
    fresh = not database.db_exists_and_seeded()
    database.init_schema()
    if fresh:
        print("First launch detected - creating and seeding the database...")
        if seed():
            print("Database seeded with sample data.")
        # For online/cloud deployments: set a strong administrator password from
        # the PPM_ADMIN_PASSWORD environment variable so the public URL is not
        # protected only by the sample credentials.
        admin_pw = os.environ.get("PPM_ADMIN_PASSWORD")
        if admin_pw:
            from backend import auth
            err = auth.validate_password(admin_pw)
            if err:
                print(f"  WARNING: PPM_ADMIN_PASSWORD not applied ({err}).")
            else:
                h, s = auth.hash_password(admin_pw)
                database.execute(
                    "UPDATE users SET password_hash=?, salt=? WHERE username='director'",
                    (h, s))
                print("  Administrator ('director') password set from PPM_ADMIN_PASSWORD.")
    else:
        print("Existing database found.")


def open_browser(url, delay=1.5):
    if os.environ.get("PPM_NO_BROWSER") == "1":
        return
    try:
        import threading
        import webbrowser
        threading.Timer(delay, lambda: webbrowser.open(url)).start()
    except Exception:
        pass


if __name__ == "__main__":
    role, data = cluster.acquire_or_locate()

    if role == "client":
        # Another instance is already serving the shared database.
        url = data
        print("=" * 62)
        print("  Enterprise PPM Platform")
        print("  A shared instance is already running for this folder.")
        print(f"  Opening your browser at:  {url}")
        print("=" * 62)
        open_browser(url, delay=0.2)
        # Give the browser a moment to launch, then exit (no second server).
        import time
        time.sleep(2)
        sys.exit(0)

    # We are the host.
    bootstrap()
    stop_heartbeat = cluster.start_heartbeat(data)

    local_url = f"http://127.0.0.1:{config.PORT}"
    lan_url = data.get("url", local_url)
    open_browser(local_url)
    try:
        server.serve(lan_url=lan_url)
    finally:
        try:
            stop_heartbeat.set()
        except Exception:
            pass
        cluster.release()
