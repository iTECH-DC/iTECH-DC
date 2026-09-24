#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUT="$ROOT/native/build"
"$ROOT/tools/build_native_release.sh"
KERNEL="${ALICE_KERNEL:-}"
if [ -z "$KERNEL" ]; then
  KERNEL=$(ls /boot/vmlinuz-* 2>/dev/null | head -n 1 || true)
fi
if [ -z "$KERNEL" ] || [ ! -f "$KERNEL" ]; then
  echo "No Linux kernel found. Set ALICE_KERNEL=/path/to/vmlinuz." >&2
  exit 4
fi
STAGE="$OUT/boot-staging"
rm -rf "$STAGE"
mkdir -p "$STAGE/boot/grub"
cp "$KERNEL" "$STAGE/boot/vmlinuz-alice"
cp "$OUT/initrd-alice.img" "$STAGE/boot/initrd-alice.img"
VERSION=$(cat "$ROOT/VERSION")
cat > "$STAGE/boot/grub/grub.cfg" <<CFG
set timeout=3
set default=0
menuentry 'Alice OS $VERSION' {
  linux /boot/vmlinuz-alice console=tty0 console=ttyS0
  initrd /boot/initrd-alice.img
}
CFG
printf '%s\n' "Boot staging: $STAGE" "Kernel: $KERNEL" "Initramfs: $OUT/initrd-alice.img"
sha256sum "$STAGE/boot/vmlinuz-alice" "$STAGE/boot/initrd-alice.img" "$STAGE/boot/grub/grub.cfg" > "$OUT/BOOT_ARTIFACTS.sha256"
