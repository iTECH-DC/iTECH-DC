#!/bin/bash
# Alice OS 14.0 — shrink rootfs, build squashfs, assemble a hybrid (BIOS+UEFI) ISO.
set -e
CHROOT=/workspace/iso-build/chroot
IMG=/workspace/iso-build/image
OUT=/workspace/iso-build/alice-os-14.0-amd64.iso

echo "== Shrinking rootfs =="
rm -rf "$CHROOT/usr/share/doc/"*       2>/dev/null || true
rm -rf "$CHROOT/usr/share/man/"*       2>/dev/null || true
rm -rf "$CHROOT/usr/share/info/"*      2>/dev/null || true
find "$CHROOT/usr/share/locale" -mindepth 1 -maxdepth 1 -type d ! -name 'en*' -exec rm -rf {} + 2>/dev/null || true
rm -rf "$CHROOT/var/cache/apt/"*       2>/dev/null || true
rm -rf "$CHROOT/var/lib/apt/lists/"*   2>/dev/null || true
rm -rf "$CHROOT/root/.cache/"*         2>/dev/null || true
rm -rf "$CHROOT/tmp/"*                 2>/dev/null || true
rm -rf "$CHROOT/usr/share/plymouth/themes/"* 2>/dev/null || true
find "$CHROOT" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true
du -sh "$CHROOT" || true

echo "== Preparing ISO staging =="
rm -rf "$IMG"; mkdir -p "$IMG/live" "$IMG/boot/grub"

# Kernel + initrd
KERNEL=$(ls "$CHROOT"/boot/vmlinuz-* | head -1)
INITRD=$(ls "$CHROOT"/boot/initrd.img-* | head -1)
cp "$KERNEL" "$IMG/live/vmlinuz"
cp "$INITRD" "$IMG/live/initrd.img"
echo "kernel: $KERNEL"
echo "initrd: $INITRD"

echo "== Building squashfs (xz) =="
mksquashfs "$CHROOT" "$IMG/live/filesystem.squashfs" \
  -comp xz -b 1M -no-progress -e boot

echo "== Writing grub.cfg =="
cat > "$IMG/boot/grub/grub.cfg" <<'EOF'
set default=0
set timeout=5
insmod all_video
set gfxpayload=keep

menuentry "Alice OS 14.0 — Live (Smarter, Safer, Yours)" {
    linux  /live/vmlinuz boot=live config components quiet splash loglevel=3
    initrd /live/initrd.img
}
menuentry "Alice OS 14.0 — Live (verbose / debug)" {
    linux  /live/vmlinuz boot=live config components
    initrd /live/initrd.img
}
menuentry "Alice OS 14.0 — Live (safe graphics, nomodeset)" {
    linux  /live/vmlinuz boot=live config components nomodeset quiet
    initrd /live/initrd.img
}
EOF

echo "== Building hybrid ISO =="
grub-mkrescue --compress=xz -o "$OUT" "$IMG" 2>&1 | tail -5

ls -lh "$OUT"
echo "ISO_BUILD_DONE"
