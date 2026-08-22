#!/usr/bin/env python3
"""Local chambers desk. Serves the Metro UI and /api/court/* (stdlib only)."""
from __future__ import annotations

import json
import mimetypes
import os
import posixpath
import re
import subprocess
import sys
import threading
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

import court
import forums

VERSION = "1.1.1"
HOST, PORT = "127.0.0.1", 8765

HERE = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(HERE, "web")
if not os.path.isdir(WEB_DIR):
    alt = os.path.join(HERE, "..", "web")
    if os.path.isdir(alt):
        WEB_DIR = os.path.abspath(alt)

MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".map": "application/json",
    ".txt": "text/plain; charset=utf-8",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
}

_httpd = None


def _err(e):
    return e if isinstance(e, str) else (str(e) if e else "Something went wrong.")


def nclt_type_from_abbr(abbr):
    a = (abbr or "").upper().replace(" ", "")
    if "IB" in a and ("CP" in a or "C.P" in a or "PETITION" in a):
        return "16"
    if "CAA" in a and "CP" in a:
        return "15"
    if "CAA" in a:
        return "14"
    if "IA" in a:
        return "20"
    return "16"


def sat_hit(h):
    lt = h.get("list_type") or "Cause list"
    if lt.startswith("SAT · "):
        lt = lt[6:]
    return {
        "caseno": h.get("caseno") or "",
        "serial": h.get("serial") or "",
        "parties": h.get("parties") or "",
        "caption": h.get("caseno") or h.get("caption") or "",
        "court": h.get("court") or "",
        "judge": h.get("judge") or "",
        "list_type": lt,
        "advocates": h.get("advs") or h.get("advocates") or [],
        "connected": h.get("connected") or "",
        "href": h.get("href") or "",
        "type_name": h.get("type_name") or "SEBI",
        "no": h.get("no") or "",
        "year": h.get("year") or "",
    }


def nclt_hit(h):
    return {
        "caseno": h.get("caseno") or "",
        "serial": h.get("serial") or "",
        "parties": h.get("parties") or "",
        "caption": h.get("caseno") or h.get("caption") or "",
        "court": h.get("court") or "",
        "judge": h.get("judge") or h.get("court") or "",
        "list_type": h.get("court") or "Cause list",
        "advocates": h.get("advs") or h.get("advocates") or [],
        "connected": h.get("connected") or "",
        "href": h.get("href") or "",
        "type_name": h.get("type_name") or "NCLT",
        "no": h.get("no") or "",
        "year": h.get("year") or "",
        "bench": h.get("bench") or (h.get("add") or {}).get("bench") or "9",
    }


def dispatch(op, data):
    data = data or {}
    if op == "fetch-case-types":
        try:
            types = court.get_case_types(str(data.get("side") or "2"))
            return {"ok": True, "types": types}
        except Exception as e:
            return {"ok": False, "error": _err(e), "types": []}

    if op == "fetch-case":
        try:
            forum = data.get("forum") or "bhc"
            if forum == "sat":
                result = forums.search_sat(data)
                lookup = court.to_lookup(result)
                lookup["act"] = (result.get("meta") or {}).get("type_name") or lookup.get("act") or ""
                return {"ok": True, "lookup": lookup}
            if forum == "nclt":
                result = forums.search_nclt(data)
                lookup = court.to_lookup(result)
                meta = result.get("meta") or {}
                lookup["act"] = " · ".join(
                    x for x in [meta.get("type_name"), meta.get("bench_label")] if x
                )
                return {"ok": True, "lookup": lookup}
            result = court.search_case(data)
            return {"ok": True, "lookup": court.to_lookup(result)}
        except Exception as e:
            return {"ok": False, "error": _err(e)}

    if op == "fetch-orders":
        try:
            keys = data.get("keys") or []
            parties = {
                "petitioner": data.get("petitioner") or "",
                "respondent": data.get("respondent") or "",
            }
            forum = data.get("forum") or "bhc"
            if forum == "sat":
                result = forums.search_sat(data)
                files = court.files_from_orders(
                    result["opener"],
                    result["orders"],
                    keys,
                    {
                        "petitioner": parties["petitioner"] or result["petitioner"],
                        "respondent": parties["respondent"] or result["respondent"],
                    },
                    forums.SAT + "/orders",
                )
                return {"ok": True, "files": files}
            if forum == "nclt":
                result = forums.search_nclt(data)
                files = court.files_from_orders(
                    result["opener"],
                    result["orders"],
                    keys,
                    {
                        "petitioner": parties["petitioner"] or result["petitioner"],
                        "respondent": parties["respondent"] or result["respondent"],
                    },
                    forums.EFILE + "/casehistorybeforeloginmenutrue.drt",
                )
                return {"ok": True, "files": files}
            files = court.download_bhc_orders(data, keys, parties)
            return {"ok": True, "files": files}
        except Exception as e:
            return {"ok": False, "error": _err(e), "files": []}

    if op == "fetch-causelist-judges":
        try:
            judges = court.list_causelist_day(str(data.get("date") or ""))
            return {"ok": True, "judges": judges}
        except Exception as e:
            return {"ok": False, "error": _err(e), "judges": []}

    if op == "scan-causelist-batch":
        try:
            hits = court.scan_causelist_pdfs(
                data.get("items") or [],
                data.get("watched") or [],
                data.get("tracked") or [],
            )
            return {"ok": True, "hits": hits}
        except Exception as e:
            return {"ok": False, "error": _err(e), "hits": []}

    if op == "scan-bhc-day":
        try:
            out = court.scan_bhc_day(
                str(data.get("date") or ""),
                data.get("watched") or [],
                data.get("tracked") or [],
            )
            return {"ok": True, "hits": out.get("hits") or [], "judges": out.get("judges") or 0}
        except Exception as e:
            return {"ok": False, "error": _err(e), "hits": [], "judges": 0}

    if op == "download-causelist-pdf":
        try:
            file = court.fetch_causelist_pdf(
                str(data.get("date") or ""),
                str(data.get("judge") or ""),
                str(data.get("list_type") or ""),
            )
            if not file:
                return {"ok": False, "error": "Could not fetch that cause list."}
            return {"ok": True, "file": file}
        except Exception as e:
            return {"ok": False, "error": _err(e)}

    if op == "scan-nclt":
        try:
            raw = forums.scan_nclt(
                data.get("dates") or [],
                data.get("tracked") or [],
                data.get("watched") or [],
                data.get("benches") or ["9"],
            )
            return {"ok": True, "hits": [nclt_hit(h) for h in raw]}
        except Exception as e:
            return {"ok": False, "error": _err(e), "hits": []}

    if op == "scan-sat":
        try:
            raw = forums.scan_sat(
                data.get("dates") or [],
                data.get("tracked") or [],
                data.get("watched") or [],
            )
            return {"ok": True, "hits": [sat_hit(h) for h in raw]}
        except Exception as e:
            return {"ok": False, "error": _err(e), "hits": []}

    if op == "resolve-listing":
        try:
            forum = data.get("forum") or "bhc"
            if forum == "sat":
                kind = (data.get("abbr") or "SEBI").upper()
                ctype = next(
                    (t["value"] for t in forums.SAT_TYPES if t["label"].upper() == kind),
                    "1",
                )
                params = {
                    "forum": "sat",
                    "side": "2",
                    "stampreg": "R",
                    "case_type": ctype,
                    "case_no": forums.pad_sat(data.get("no") or ""),
                    "year": str(data.get("year") or ""),
                }
                result = forums.search_sat(params)
                lookup = court.to_lookup(result)
                lookup["act"] = kind
                return {"ok": True, "params": params, "type_name": kind, "lookup": lookup}
            if forum == "nclt":
                params = {
                    "forum": "nclt",
                    "bench": data.get("bench") or "9",
                    "side": "2",
                    "stampreg": "R",
                    "case_type": nclt_type_from_abbr(data.get("abbr") or ""),
                    "case_no": re.sub(r"\D", "", str(data.get("no") or "")),
                    "year": str(data.get("year") or ""),
                }
                result = forums.search_nclt(params)
                lookup = court.to_lookup(result)
                type_name = data.get("abbr") or "NCLT"
                return {
                    "ok": True,
                    "params": params,
                    "type_name": type_name,
                    "lookup": lookup,
                }
            resolved = court.resolve_bhc_listing(data)
            return {"ok": True, **resolved}
        except Exception as e:
            return {"ok": False, "error": _err(e)}

    return {"ok": False, "error": "Unknown court action: %s" % op}


def _home():
    return os.path.expanduser("~")


def _desktop():
    d = os.path.join(_home(), "Desktop")
    return d if os.path.isdir(d) else _home()


def _default_root():
    return os.path.join(_desktop(), "Bombay HC matters")


def fs_info():
    return {
        "ok": True,
        "fs": True,
        "version": VERSION,
        "home": _home(),
        "desktop": _desktop(),
        "defaultRoot": _default_root(),
    }


def _expand(p):
    raw = (p or "").strip()
    if not raw:
        raise RuntimeError("Missing folder.")
    return os.path.realpath(os.path.expanduser(raw))


def _under_home(p):
    home = os.path.realpath(_home())
    real = os.path.realpath(p)
    if real == home or real.startswith(home + os.sep):
        return real
    if real.startswith("/Volumes" + os.sep):
        return real
    raise RuntimeError("Folder must be inside your home directory or a mounted volume.")


def dispatch_fs(op, data):
    if op == "choose-folder":
        prompt = (data.get("prompt") or "Folder for orders").replace('"', "'")
        try:
            proc = subprocess.run(
                ["osascript", "-e", 'POSIX path of (choose folder with prompt "%s")' % prompt],
                capture_output=True,
                text=True,
                timeout=180,
            )
        except Exception as e:
            return {"ok": False, "error": _err(e)}
        if proc.returncode != 0:
            return {"ok": False, "error": "Cancelled."}
        path = (proc.stdout or "").strip()
        if not path:
            return {"ok": False, "error": "Cancelled."}
        return {"ok": True, "path": path.rstrip("/")}
    if op == "open-folder":
        try:
            path = _under_home(_expand(data.get("path") or _default_root()))
            if not os.path.isdir(path):
                os.makedirs(path, exist_ok=True)
            subprocess.Popen(["open", path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": _err(e)}
    if op == "save-pdf":
        try:
            folder = _under_home(_expand(data.get("folder") or ""))
            filename = re.sub(r"[\\/]", "", str(data.get("filename") or "order.pdf"))
            b64 = data.get("base64") or ""
            if not b64:
                return {"ok": False, "error": "Missing PDF."}
            os.makedirs(folder, exist_ok=True)
            dest = os.path.join(folder, filename)
            if os.path.exists(dest):
                return {"ok": True, "path": dest, "existed": True}
            raw = base64.b64decode(b64)
            if raw[:5] != b"%PDF-":
                return {"ok": False, "error": "That file is not a PDF."}
            with open(dest, "wb") as f:
                f.write(raw)
            return {"ok": True, "path": dest, "existed": False}
        except Exception as e:
            return {"ok": False, "error": _err(e)}
    return {"ok": False, "error": "Unknown file action: %s" % op}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("[desk] " + (fmt % args) + "\n")

    def _send(self, code, body, content_type="application/json; charset=utf-8"):
        if isinstance(body, str):
            raw = body.encode("utf-8")
        else:
            raw = body
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj, ensure_ascii=False))

    def _read_json(self):
        n = int(self.headers.get("Content-Length") or "0")
        raw = self.rfile.read(n) if n else b"{}"
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8", "replace"))
        except Exception:
            return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path or "/")
        if path == "/api/health":
            self._json(fs_info())
            return
        if path == "/api/version":
            self._json({"version": VERSION})
            return
        self._static(path)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path or "/")
        if path == "/api/quit":
            self._json({"ok": True})
            threading.Thread(target=_shutdown, daemon=True).start()
            return
        if path.startswith("/api/court/"):
            op = path[len("/api/court/") :].strip("/")
            data = self._read_json()
            self._json(dispatch(op, data))
            return
        if path.startswith("/api/fs/"):
            op = path[len("/api/fs/") :].strip("/")
            data = self._read_json()
            self._json(dispatch_fs(op, data))
            return
        self._json({"ok": False, "error": "Not found."}, 404)

    def _static(self, path):
        if path == "/":
            path = "/index.html"
        rel = posixpath.normpath(path.lstrip("/"))
        if rel.startswith(".."):
            self._send(403, b"Forbidden", "text/plain")
            return
        dest = os.path.join(WEB_DIR, rel)
        if not os.path.isfile(dest):
            dest = os.path.join(WEB_DIR, "index.html")
        if not os.path.isfile(dest):
            self._send(404, b"Not found", "text/plain")
            return
        ext = os.path.splitext(dest)[1].lower()
        ctype = MIME.get(ext) or mimetypes.guess_type(dest)[0] or "application/octet-stream"
        with open(dest, "rb") as f:
            data = f.read()
        self._send(200, data, ctype)


def _shutdown():
    global _httpd
    if _httpd:
        _httpd.shutdown()


def main():
    global _httpd
    if "--serve" not in sys.argv and "-s" not in sys.argv:
        print("Binder Builder %s — python3 server.py --serve" % VERSION)
        return
    if not os.path.isdir(WEB_DIR):
        sys.stderr.write("Missing UI folder: %s\n" % WEB_DIR)
        sys.exit(1)
    _httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    _httpd.daemon_threads = True
    print("Binder Builder %s on http://%s:%s" % (VERSION, HOST, PORT))
    try:
        _httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
