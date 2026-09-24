#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
"$ROOT/tools/build_native_release.sh"
if ! command -v grub-mkrescue >/dev/null 2>&1; then
  echo "grub-mkrescue is not installed. Boot staging was built, but ISO creation is unavailable in this environment." >&2
  exit 3
fi
if ! command -v xorriso >/dev/null 2>&1; then
  echo "xorriso is not installed. Boot staging was built, but ISO creation is unavailable in this environment." >&2
  exit 3
fi
VERSION=$(cat "$ROOT/VERSION")
OUT="$ROOT/native/build/Alice_OS_${VERSION}_x86_64.iso"
grub-mkrescue -o "$OUT" "$ROOT/native/build/boot-staging"
printf '%s\n' "Created $OUT"
