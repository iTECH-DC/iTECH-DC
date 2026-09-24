#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
cd "$ROOT"
URL="http://127.0.0.1:8765"
if command -v curl >/dev/null 2>&1 && curl -fsS --max-time 2 "$URL/api/health" >/dev/null 2>&1; then
  echo "Alice OS is already running at $URL"
  command -v xdg-open >/dev/null 2>&1 && xdg-open "$URL" >/dev/null 2>&1 &
  exit 0
fi
if command -v python3 >/dev/null 2>&1; then PY=python3
elif command -v python >/dev/null 2>&1; then PY=python
else echo 'ERROR: Python 3 was not found.' >&2; exit 1; fi
exec "$PY" "$ROOT/run_alice.py"
