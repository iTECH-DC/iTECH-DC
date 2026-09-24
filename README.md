# Alice OS 14.0

**Smarter • Safer • Yours** — a standalone, bootable operating system with a
fully-offline voice assistant that doubles as an owner-authorized ethical-hacking
workbench.

Alice OS 14.0 is a complete Debian-based live operating system. You write the ISO
to a USB stick, boot your second PC from it, and you get a full desktop that boots
straight into the Alice OS interface — no installation, no cloud, no telemetry.

---

## What's inside

| Layer | Detail |
|-------|--------|
| Base OS | Debian 12 "bookworm" (amd64), live-boot + live-config |
| Kernel | Linux 6.1 LTS (`linux-image-amd64`) |
| Desktop | Xorg + Openbox, Chromium in kiosk mode |
| UI | Vanilla HTML/CSS/JS desktop (glass UI, window manager, taskbar) |
| Voice STT | **Vosk** offline speech recognition (16 kHz mono PCM, no ffmpeg) |
| Voice TTS | **espeak-ng** offline speech synthesis |
| Assistant | Local "ethical-hacking assistant" brain (`alice_core/intelligence/assistant.py`) |
| Security | Defensive workbench: local recon, port audit, nmap-localhost, config/dependency audit, secret scan, file hashing, tool status |
| Server | Python `ThreadingHTTPServer`, bound to `127.0.0.1:8765` (loopback only) |
| Boot | Hybrid ISO — boots on **BIOS and UEFI** systems |

Everything runs locally. The network stack is loopback-only by default; the
assistant refuses and logs any request that targets a third party.

---

## Quick start (build the ISO)

On a Debian/Ubuntu build host with `sudo`:

```bash
sudo apt-get update
sudo apt-get install -y debootstrap squashfs-tools xorriso grub-pc-bin \
    grub-efi-amd64-bin grub-common mtools dosfstools isolinux syslinux-common \
    syslinux-efi cpio rsync

# 1) Build the Debian rootfs (downloads packages, ~1.6 GB)
bash iso-build/install_chroot.sh

# 2) Copy the Alice OS app + kiosk configuration into the rootfs
bash iso-build/copy_payload.sh

# 3) Shrink the rootfs and produce the bootable hybrid ISO
bash iso-build/build_iso.sh
```

The result is `iso-build/alice-os-14.0-amd64.iso`.

### Write it to a USB stick

```bash
# Replace /dev/sdX with your USB device (CHECK THIS CAREFULLY)
sudo dd if=iso-build/alice-os-14.0-amd64.iso of=/dev/sdX bs=4M status=progress oflag=sync
```

Then boot your second PC from the USB stick (usually F12 / F10 / Del for the boot
menu). Alice OS boots to the desktop automatically as the local `alice` user.

---

## Using the voice assistant

1. Click the glowing orb (top-left) or **Start ▸ Alice Voice**.
2. Press **Hold a conversation** and speak, or toggle **Continuous** for a
   hands-free loop.
3. Enable **Wake word** and say *"Alice …"* to trigger commands by voice.

Try saying:

- *"System status"* — CPU / RAM / storage / platform inventory
- *"List my listening ports"* — local port audit (`ss`)
- *"Scan localhost"* — `nmap` against `127.0.0.1` only
- *"Run a security audit"* — Alice hardening checks
- *"List security tools"* — installed/available workbench tools
- *"Hash file notes.txt"* — SHA-256 integrity hash inside the workspace

The assistant answers in a short spoken summary and shows the full structured
result in the transcript / workbench.

### Safety boundary

Alice OS is **defensive and owner-authorized by design**. It will refuse and log
requests such as attacking third parties, credential theft, malware creation,
authentication bypass, persistence, or denial-of-service. Network probing is
restricted to `127.0.0.1`; file analysis is confined to the Alice workspace.

Every voice/chat security command is written to an owner-auditable log
(`data/security_events.json`, surfaced in **Security Workbench ▸ Owner audit log**).

---

## Run the app without building the OS

The Alice OS application also runs directly on any Linux/macOS/Windows host with
Python 3.11+:

```bash
cd alice-os
pip install -r requirements.txt          # optional extras
pip install vosk                          # offline speech recognition
# place a Vosk model in voice_models/vosk-model-small-en-us-0.15
sudo apt-get install -y espeak-ng         # offline text-to-speech
python3 run_alice.py
# open http://127.0.0.1:8765
```

---

## Repository layout

```
alice-os/                  # the application (server + UI + intelligence core)
  run_alice.py             # local HTTP server + API
  ui/                      # desktop UI (index.html, app.js, style.css, voice.js, security.js)
  alice_core/
    voice/engine.py        # offline STT (Vosk) + TTS (espeak-ng)
    intelligence/assistant.py   # ethical-hacking assistant brain + safety boundary
    intelligence/cyber_lab.py   # defensive security tools
  native/                  # native PID1 init + initramfs builder
  tools/                   # helper build scripts
iso-build/                 # standalone OS build pipeline
  install_chroot.sh        # debootstrap + package install
  copy_payload.sh          # copy app + kiosk config into the rootfs
  build_iso.sh             # shrink + squashfs + hybrid ISO
  payload/                 # systemd units, autologin, kiosk autostart, banner
docs/                      # architecture and build documentation
```

---

## License & intent

Alice OS is provided for **owner-authorized, defensive security work and personal
use on hardware you own**. You are responsible for complying with all applicable
laws. Do not use it to access, attack, or surveil systems you do not own or have
explicit written permission to test.
