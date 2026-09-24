#!/bin/bash
# Alice OS 14.0 — copy the application + configuration into the chroot.
set -e
CHROOT=/workspace/iso-build/chroot
SRC=/workspace/alice-os
PAY=/workspace/iso-build/payload

# 1) Application tree -> /opt/alice-os
rm -rf "$CHROOT/opt/alice-os"
mkdir -p "$CHROOT/opt/alice-os"
rsync -a --exclude '__pycache__' --exclude '*.pyc' --exclude 'data/alice_cloud.db*' \
      --exclude 'data/*.pid' "$SRC/" "$CHROOT/opt/alice-os/"

# 2) Overlay configuration payload (systemd units, autologin, kiosk, banner)
cp -a "$PAY/." "$CHROOT/"

# 3) Create the local owner account.
chroot "$CHROOT" bash -c "id alice >/dev/null 2>&1 || useradd -m -s /bin/bash -G sudo,audio,video,cdrom,plugdev,netdev alice"
chroot "$CHROOT" bash -c "echo 'alice:alice' | chpasswd"

# 4) Ownership + permissions.
chroot "$CHROOT" bash -c "chown -R alice:alice /opt/alice-os /home/alice"
chmod 755 "$CHROOT/home/alice/.xinitrc" 2>/dev/null || true
chmod 440 "$CHROOT/etc/sudoers.d/alice" 2>/dev/null || true

# 5) Enable the services.
chroot "$CHROOT" systemctl enable alice-os.service alice-kiosk.service >/dev/null 2>&1 || true
chroot "$CHROOT" systemctl enable NetworkManager >/dev/null 2>&1 || true
chroot "$CHROOT" systemctl set-default graphical.target >/dev/null 2>&1 || true

# 6) Install the offline speech engine (vosk) into the system Python.
chroot "$CHROOT" bash -c "pip3 install --break-system-packages --no-cache-dir vosk 2>/dev/null || pip3 install --break-system-packages --no-cache-dir vosk" || \
  echo "WARN: vosk pip install failed (offline voice STT may be unavailable)"

# 7) Branding: os-release.
cat > "$CHROOT/etc/os-release" <<EOF
PRETTY_NAME="Alice OS 14.0"
NAME="Alice OS"
VERSION_ID="14.0"
VERSION="14.0 (Smarter Safer Yours)"
ID=alice
ID_LIKE=debian
HOME_URL="https://github.com/iTECH-DC/iTECH-DC"
SUPPORT_URL="https://github.com/iTECH-DC/iTECH-DC"
BUG_REPORT_URL="https://github.com/iTECH-DC/iTECH-DC/issues"
EOF
echo "Alice OS 14.0 \\\\n \\\\l" > "$CHROOT/etc/issue"

# 8) Live-boot configuration (hostname + autologin).
mkdir -p "$CHROOT/etc/live/config.conf.d"
cat > "$CHROOT/etc/live/config.conf.d/alice.conf" <<EOF
LIVE_HOSTNAME="alice-os"
LIVE_USERNAME="alice"
LIVE_USER_FULLNAME="Alice Owner"
LIVE_USER_DEFAULT_GROUPS="audio video cdrom plugdev netdev sudo"
EOF

echo "PAYLOAD_DONE"
