#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUT="$ROOT/native/build"
rm -rf "$OUT"
mkdir -p "$OUT/rootfs/bin" "$OUT/rootfs/dev" "$OUT/rootfs/proc" "$OUT/rootfs/sys"
cc -Wall -Wextra -O2 "$ROOT/native/src/alice-init.c" -o "$OUT/rootfs/bin/alice-init"
# PID 1 must be a self-contained executable; do not depend on /bin/sh in the tiny initramfs.
cp "$OUT/rootfs/bin/alice-init" "$OUT/rootfs/init"
chmod +x "$OUT/rootfs/init"
( cd "$OUT/rootfs" && find . -print0 | cpio --null -ov --format=newc > "$OUT/initrd-alice.img" )
sha256sum "$OUT/initrd-alice.img" "$OUT/rootfs/init" "$OUT/rootfs/bin/alice-init" > "$OUT/BOOT_ARTIFACTS.sha256"
printf '%s\n' "Built native initramfs: $OUT/initrd-alice.img"
printf '%s\n' "Wrote native checksums: $OUT/BOOT_ARTIFACTS.sha256"
printf '%s\n' 'A Linux kernel and GRUB/xorriso are required for a bootable ISO.'
