#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
fail=0
for tool in cc cpio grub-mkrescue xorriso qemu-system-x86_64; do
  if command -v "$tool" >/dev/null 2>&1; then
    printf 'PASS | %s | %s\n' "$tool" "$(command -v "$tool")"
  else
    printf 'MISSING | %s\n' "$tool"
    fail=1
  fi
done
"$ROOT/tools/build_native_release.sh"
"$ROOT/tools/check_release.py" 2>/dev/null || true
if [ "$fail" -ne 0 ]; then
  echo "Boot finalization cannot run until the missing host tools are installed."
  exit 3
fi
"$ROOT/tools/build_iso.sh"
VERSION=$(cat "$ROOT/VERSION")
ISO="$ROOT/native/build/Alice_OS_${VERSION}_x86_64.iso"
qemu-system-x86_64 -machine q35 -m 1024 -cdrom "$ISO" -boot d -display none -serial stdio -no-reboot -no-shutdown
