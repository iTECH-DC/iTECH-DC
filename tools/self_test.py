#!/usr/bin/env python3
"""Alice OS local integration self-test; uses the backend in-process on loopback."""
from __future__ import annotations
import json, sys, threading, time, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import run_alice

BASE = f"http://{run_alice.ALICE_BIND_HOST}:{run_alice.PORT}"

def get(path):
    with urllib.request.urlopen(BASE + path, timeout=4) as r:
        return r.status, json.loads(r.read().decode())

def main():
    version = (ROOT / "VERSION").read_text().strip()
    run_alice.WALLPAPERS.mkdir(exist_ok=True); run_alice.DATA.mkdir(exist_ok=True); run_alice.LOG_DIR.mkdir(exist_ok=True)
    run_alice.start_monitor()
    run_alice.write_json_file(run_alice.SUPERVISOR_FILE, run_alice.supervisor_config())
    server = run_alice.ThreadingHTTPServer((run_alice.ALICE_BIND_HOST, run_alice.PORT), run_alice.AliceHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    try:
        time.sleep(.15)
        checks = [
            ("health", "/api/health", lambda x: x.get("version") == version and x.get("offline") is True),
            ("offline", "/api/offline/status", lambda x: x.get("offline") is True),
            ("AI status", "/api/ai/status", lambda x: "routing_mode" in x or "friday" in str(x).lower()),
            ("security", "/api/security/status", lambda x: isinstance(x, dict)),
            ("diagnostics", "/api/diagnostics", lambda x: isinstance(x, dict)),
            ("task manager", "/api/control/task-manager", lambda x: isinstance(x, dict)),
            ("updates", "/api/control/updates", lambda x: isinstance(x, dict)),
            ("network", "/api/network/interfaces", lambda x: isinstance(x, dict)),
            ("workspace", "/api/workspace", lambda x: isinstance(x, dict)),
        ]
        failures = 0
        print(f"Alice OS {version} integration self-test")
        for name, path, predicate in checks:
            try:
                status, data = get(path); ok = status == 200 and predicate(data)
                print(f"{'PASS' if ok else 'FAIL'} | {name} | HTTP {status}")
            except Exception as exc:
                ok = False; print(f"FAIL | {name} | {exc}")
            failures += int(not ok)
        boot = ROOT / "native/build/initrd-alice.img"; init = ROOT / "native/build/rootfs/init"
        print(f"{'PASS' if boot.exists() else 'FAIL'} | Alice initramfs | {boot}")
        print(f"{'PASS' if init.exists() else 'FAIL'} | Native /init | {init}")
        failures += int(not boot.exists()) + int(not init.exists())
        print("RESULT: PASS" if failures == 0 else f"RESULT: FAIL ({failures} checks)")
        return 0 if failures == 0 else 1
    finally:
        server.shutdown(); server.server_close()

if __name__ == "__main__": raise SystemExit(main())
