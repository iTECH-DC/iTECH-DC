# Alice OS 14.0 — Release Notes

**Codename:** Standalone
**Release date:** 2026-09-24
**Base:** Debian 12 "bookworm" (amd64), Linux 6.1 LTS
**Artifact:** `alice-os-14.0-amd64.iso` (hybrid BIOS + UEFI, ~451 MB)

---

## Headline

Alice OS is no longer "a Python app you run on your desktop". Version 14.0 is a
**standalone, bootable operating system**. You write one ISO to a USB stick, boot
a second PC from it, and land in a full Alice desktop — with a **fully-offline
voice assistant** that also works as an **owner-authorized ethical-hacking
workbench**.

No installation. No cloud. No telemetry. Everything runs on the machine in front
of you.

---

## What's new in 14.0

### 1. It boots as a real OS
- Debian 12 live rootfs built with `debootstrap --variant=minbase`.
- `live-boot` + `live-config` provide a RAM-backed overlay (the USB is never
  written to during a normal session).
- A **hybrid ISO** that boots on both legacy **BIOS** and modern **UEFI** firmware
  (GRUB2 with `grub-mkrescue`, El-Torito BIOS + EFI boot images).
- Autologin on `tty1` → `startx` → Openbox → Chromium in `--kiosk` mode pointed at
  the local Alice server. It feels like an appliance, not a browser.

### 2. Working offline voice assistant
- **Speech-to-text:** Vosk `vosk-model-small-en-us-0.15`, running entirely
  offline. The browser captures 16 kHz mono PCM through the Web Audio API and
  POSTs it to the local server — no ffmpeg, no cloud STT.
- **Text-to-speech:** `espeak-ng`, fully offline.
- **Voice UI:** a glass "voice orb" panel with a live waveform visualizer, an
  animated state orb (ready / listening / thinking / speaking), a live transcript,
  continuous-listening mode, and an optional wake-word toggle.
- Voice commands are routed into the same intelligence core that the text chat
  uses, so "scan my local ports" or "what is my CPU usage" work by voice.

### 3. Ethical-hacking assistant with a hard safety boundary
- A **Security Workbench** panel exposes 16 defensive tools, including:
  System Inventory, Local Port Audit, Nmap (localhost only), Alice Security Audit,
  Python Dependency Audit, Workspace Secret Scan, File Integrity Hash, and status
  probes for Metasploit, Hashcat, SQLmap, ZAP, YARA, ClamAV, TShark, Semgrep and
  Trivy.
- **Scope is loopback-only.** The assistant probes `127.0.0.1`, audits the local
  workspace, and reports on locally-installed tools. It never touches a third
  party.
- **Refusal engine:** requests that target someone else — e.g. *"hack my
  neighbor's wifi"*, *"steal my friend's Instagram password"*, DoS requests — are
  refused with a clear explanation and are **logged**.
- **Owner audit log:** every security intent (allowed or refused) is appended to
  `data/security_events.json` and surfaced in the Security Workbench, so the owner
  can always see exactly what was asked and what Alice did.

### 4. Cool UI
- Modern glass-morphism desktop: translucent panels, blur, animated window
  chrome, a taskbar, and a Start menu.
- New **Alice Voice** and **Security Workbench** entries in the Start menu.
- Print- and screen-friendly typography; the whole UI is vanilla HTML/CSS/JS with
  no build step.

---

## Architecture at a glance

```
USB / ISO
  └─ GRUB2 (BIOS + UEFI)
       └─ vmlinuz 6.1 + initrd (live-boot)
            └─ squashfs rootfs (xz)
                 └─ systemd
                      ├─ alice-os.service     → python3 /opt/alice-os/run_alice.py
                      │     binds 127.0.0.1:8765, serves ui/ + JSON API
                      └─ alice-kiosk.service  → startx → openbox → chromium --kiosk
                            └─ http://127.0.0.1:8765/  (the Alice desktop)
```

Voice pipeline:

```
mic → Web Audio (16 kHz Int16 PCM) → POST /api/voice/transcribe (Vosk)
    → /api/assistant/query → intent router (security / chat / refuse)
    → POST /api/voice/tts (espeak-ng) → <audio> playback
```

---

## Safety statement

Alice OS 14.0 is a **defensive** tool. Its security features are limited to the
local machine and to systems the owner is explicitly authorized to test. The
assistant is designed to refuse and log any request that would harm or intrude on
a third party. Do not use it against systems you do not own or have written
permission to test.

---

## Known limitations

- The offline Vosk *small* English model is compact and fast but not perfect;
  accuracy improves with a larger model (swap the folder in `voice_models/`).
- The live session runs from RAM; changes are not persisted across reboots unless
  you add a persistence partition (live-boot supports it).
- Boot-testing was verified structurally (valid squashfs, live-boot initrd,
  BIOS+UEFI El-Torito catalog). A physical second-PC boot is the final acceptance
  test.

---

## Upgrade path from 13.5

The 13.5 baseline is preserved in git history (commit `dce4d73`). All 14.0 work
lives under `alice-os/` (application) and `iso-build/` (OS build pipeline). The
application is a superset of 13.5 plus the voice engine, assistant brain, and
security workbench.
