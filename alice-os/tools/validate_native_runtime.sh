#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BIN="$ROOT/native/build/alice-init"
cc -Wall -Wextra -O2 "$ROOT/native/src/alice-init.c" -o "$BIN"
"$BIN" > "$ROOT/native/build/alice-init.test.log" 2>&1 &
PID=$!
sleep 2
kill -TERM "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true
grep -q 'native userspace boundary online' "$ROOT/native/build/alice-init.test.log"
grep -q 'shutdown requested' "$ROOT/native/build/alice-init.test.log"
echo 'Native runtime validation: PASS'
