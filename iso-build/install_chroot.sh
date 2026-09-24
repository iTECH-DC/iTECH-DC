#!/bin/bash
# Alice OS 14.0 — install packages into the Debian chroot.
set -e
CHROOT=/workspace/iso-build/chroot

# Bind pseudo filesystems for apt/systemd.
mount --bind /dev  "$CHROOT/dev"   2>/dev/null || true
mount --bind /dev/pts "$CHROOT/dev/pts" 2>/dev/null || true
mount -t proc proc "$CHROOT/proc"  2>/dev/null || true
mount -t sysfs sys "$CHROOT/sys"   2>/dev/null || true

cat > "$CHROOT/etc/apt/sources.list" <<EOF
deb http://deb.debian.org/debian bookworm main contrib non-free non-free-firmware
deb http://deb.debian.org/debian bookworm-updates main contrib non-free non-free-firmware
deb http://security.debian.org/debian-security bookworm-security main contrib non-free non-free-firmware
EOF

export DEBIAN_FRONTEND=noninteractive
chroot "$CHROOT" apt-get update

# Core OS + live system + kernel
chroot "$CHROOT" apt-get install -y --no-install-recommends \
  linux-image-amd64 \
  live-boot live-config live-config-systemd \
  systemd-sysv systemd-timesyncd \
  initramfs-tools \
  dbus dbus-x11 \
  sudo \
  curl ca-certificates \
  alsa-utils \
  espeak-ng \
  python3 python3-pip python3-venv \
  xserver-xorg xserver-xorg-legacy xinit x11-xserver-utils \
  openbox \
  fonts-dejavu-core fonts-dejavu-extra \
  xterm \
  unzip \
  iproute2 iputils-ping net-tools \
  usbutils pciutils \
  htop procps \
  network-manager \
  wpasupplicant rfkill \
  firmware-linux-free \
  plymouth plymouth-themes

# Browser (kiosk). Kept separate so a failure here is visible.
chroot "$CHROOT" apt-get install -y --no-install-recommends chromium

chroot "$CHROOT" apt-get clean
rm -rf "$CHROOT/var/lib/apt/lists/"*

echo "CHROOT_INSTALL_DONE"
