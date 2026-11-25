#!/usr/bin/env python3
"""Agora dev server: JSON API + static apps. Standard library only.

    python3 server.py [port]

Student app:   http://localhost:8800/student/
House console: http://localhost:8800/business/
"""
import json, os, sys, posixpath, mimetypes
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agora import db, api

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")


class Handler(SimpleHTTPRequestHandler):
    server_version = "Agora/1.0"

    def log_message(self, fmt, *args):
        try:
            line = fmt % args
        except Exception:
            line = str(fmt)
        if "/api/" in line or " 4" in line or " 5" in line:
            sys.stderr.write("  %s\n" % line)

    # ----------------------------------------------------------- plumbing
    def _json(self, status, payload):
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        # The published site is served from github.io and the app from a
        # tunnel, so the site asking "are you up?" is a cross-origin request.
        # Without this header the browser blocks it, the site concludes the
        # app is down and links to a demonstration notice — while the app is
        # running perfectly on the other end of that very URL. That is exactly
        # the failure the health check exists to prevent, arriving by another
        # road.
        #
        # Only this one route is opened, and only to GET. Every other endpoint
        # carries a bearer token, and a wildcard origin across those would let
        # any page a student happens to have open read their wallet. The
        # health reply says the app's name and two public counts; there is
        # nothing in it to protect.
        if self.path.split("?")[0] == "/api/health":
            self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(raw)

    def _ctx(self):
        tok = None
        hdr = self.headers.get("Authorization") or ""
        if hdr.startswith("Bearer "):
            tok = hdr[7:].strip()
        ctx = {"token": tok, "subject": None}
        if tok:
            row = db.q("SELECT * FROM sessions WHERE token=?", (tok,), one=True)
            if row:
                ctx["subject"] = {"type": row["subject_type"], "id": row["subject_id"]}
        return ctx

    def _handle_api(self, method, path, body):
        try:
            result = api.dispatch(method, path, self._ctx(), body)
            self._json(200, result)
        except api.ApiError as e:
            self._json(e.status, {"error": e.message})
        except Exception as e:  # keep the demo alive, but say what broke
            import traceback; traceback.print_exc()
            self._json(500, {"error": "%s: %s" % (type(e).__name__, e)})

    # -------------------------------------------------------------- verbs
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            body = {k: v[0] for k, v in parse_qs(parsed.query).items()}
            return self._handle_api("GET", parsed.path, body)
        return self._serve_static(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return self._json(404, {"error": "not found"})
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw or b"{}")
        except ValueError:
            return self._json(400, {"error": "Body is not JSON"})
        return self._handle_api("POST", parsed.path, body)

    # ------------------------------------------------------------ statics
    def _serve_static(self, path):
        if path == "/favicon.ico":
            self.send_response(204); self.end_headers(); return
        if path == "/":
            path = "/index.html"
        rel = posixpath.normpath(path).lstrip("/")
        full = os.path.join(ROOT, rel)
        if os.path.isdir(full):
            full = os.path.join(full, "index.html")
        if not os.path.abspath(full).startswith(ROOT) or not os.path.isfile(full):
            self.send_error(404, "Not found")
            return
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("text") or "javascript" in ctype else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8800
    db.init()
    srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("Agora running")
    print("  Site           http://localhost:%d/" % port)
    print("  Student app    http://localhost:%d/student/" % port)
    print("  House console  http://localhost:%d/business/" % port)
    print("  Ctrl-C to stop")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
