#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
"$ROOT/native/BUILD_NATIVE.sh"
KERNEL=$(ls /boot/vmlinuz-* 2>/dev/null | sort -V | tail -n1 || true)
INITRD=$(ls /boot/initrd.img-* 2>/dev/null | sort -V | tail -n1 || true)
OUT="$ROOT/native/build/boot-staging"
VERSION=$(cat "$ROOT/VERSION")
rm -rf "$OUT"
mkdir -p "$OUT/boot/grub"
if [ -z "$KERNEL" ]; then
  echo "No host kernel found; boot staging cannot be completed." >&2
  exit 2
fi
cp "$KERNEL" "$OUT/boot/vmlinuz-alice"
cp "$ROOT/native/build/initrd-alice.img" "$OUT/boot/initrd-alice.img"
if [ -n "$INITRD" ]; then cp "$INITRD" "$OUT/boot/initrd-host.img"; fi
cat > "$OUT/boot/grub/grub.cfg" <<EOF
set timeout=3
set default=0
menuentry 'Alice OS $VERSION' {
  linux /boot/vmlinuz-alice console=tty0 console=ttyS0
  initrd /boot/initrd-alice.img
}
EOF
sha256sum "$OUT/boot/vmlinuz-alice" "$OUT/boot/initrd-alice.img" "$OUT/boot/grub/grub.cfg" > "$ROOT/native/build/BOOT_ARTIFACTS.sha256"
printf '%s\n' "Boot staging created at $OUT" "Kernel: $KERNEL" "Alice initrd: $OUT/boot/initrd-alice.img"
