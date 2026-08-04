"""Pure-stdlib HTTP server: serves the SPA and dispatches JSON API routes.

No third-party dependencies -> guaranteed to run fully offline.
"""
import json
import os
import posixpath
import mimetypes
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import config
from . import auth
from . import api
from .api import ApiError
from .rbac import Forbidden

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")


class Handler(BaseHTTPRequestHandler):
    server_version = "PPM/1.0"

    # ---- logging kept quiet but informative ----
    def log_message(self, fmt, *args):
        print(f"  {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")

    # ---- helpers ----
    def _send_json(self, status, payload):
        body = json.dumps(payload, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        if not length:
            return None
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return None

    def _token(self):
        h = self.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            return h[7:]
        return None

    def _client_ip(self):
        return self.client_address[0] if self.client_address else None

    # ---- dispatch ----
    def _handle(self, method):
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/"):
            return self._handle_api(method, path, parse_qs(parsed.query))
        if method == "GET":
            return self._serve_static(path)
        self._send_json(405, {"error": "Method not allowed"})

    def _handle_api(self, method, path, raw_query):
        fn, params, needs_auth, min_level = api.match(method, path)
        if fn is None:
            return self._send_json(404, {"error": "Not found"})
        token = self._token()
        user = auth.user_from_token(token)
        if needs_auth and not user:
            return self._send_json(401, {"error": "Authentication required"})
        if user and min_level and user["role_level"] < min_level:
            return self._send_json(403, {"error": "Insufficient permissions"})
        query = {k: v[0] for k, v in raw_query.items()}
        ctx = {"user": user, "params": params, "query": query,
               "body": self._read_body(), "ip": self._client_ip(), "token": token}
        try:
            result = fn(ctx)
            if isinstance(result, tuple):
                status, payload = result
                return self._send_json(status, payload)
            return self._send_json(200, result)
        except ApiError as e:
            return self._send_json(e.status, {"error": e.message})
        except Forbidden as e:
            return self._send_json(403, {"error": str(e)})
        except Exception as e:  # never leak a stack trace to the client
            import traceback
            traceback.print_exc()
            return self._send_json(500, {"error": "Internal server error"})

    def _serve_static(self, path):
        if path == "/" or path == "":
            path = "/index.html"
        # normalise & prevent path traversal
        safe = posixpath.normpath(path).lstrip("/")
        full = os.path.join(config.FRONTEND_DIR, safe)
        if not os.path.abspath(full).startswith(os.path.abspath(config.FRONTEND_DIR)):
            return self._send_json(403, {"error": "Forbidden"})
        if not os.path.isfile(full):
            # SPA fallback only for extensionless navigation paths (client routes).
            # Missing asset files (e.g. vendor/echarts.min.js) must 404 so the
            # browser's onerror/fallback logic works instead of receiving HTML.
            last = safe.rsplit("/", 1)[-1]
            if "." in last:
                return self._send_json(404, {"error": "Not found"})
            full = os.path.join(config.FRONTEND_DIR, "index.html")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        try:
            with open(full, "rb") as fh:
                data = fh.read()
        except OSError:
            return self._send_json(404, {"error": "Not found"})
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._handle("GET")

    def do_POST(self):
        self._handle("POST")

    def do_PUT(self):
        self._handle("PUT")

    def do_DELETE(self):
        self._handle("DELETE")


def serve(lan_url=None):
    httpd = ThreadingHTTPServer((config.HOST, config.PORT), Handler)
    local_url = f"http://127.0.0.1:{config.PORT}"
    print("=" * 62)
    print("  Enterprise PPM Platform  -  running")
    print(f"  On this computer:      {local_url}")
    if lan_url and lan_url != local_url and config.HOST == "0.0.0.0":
        print(f"  For others on your LAN: {lan_url}")
        print("  (Share that address with teammates — they just open it in a browser.)")
    print("  Sample logins (username / password):")
    print("     director   / director123     (full access)")
    print("     manager    / manager123       (destination + team)")
    print("     specialist / specialist123    (assigned tasks)")
    print("     clerk      / clerk123          (read-only)")
    print("  Keep this window open while the tool is in use. Ctrl+C to stop.")
    print("=" * 62)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down. Goodbye.")
        httpd.shutdown()
