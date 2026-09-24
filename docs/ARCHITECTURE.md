# Alice OS 14.0 — Architecture

## Overview

Alice OS 14.0 is a single-machine, offline-first operating system. It is built as
a Debian 12 live image whose entire user experience is the Alice OS desktop served
by a loopback-only Python server.

```
        +-------------------------------------------------------------+
        |                      Alice OS 14.0 (live)                   |
        |                                                             |
        |   Chromium (kiosk)  <---- http://127.0.0.1:8765 ---+        |
        |        |                                           |        |
        |        |  Web Audio (PCM)                          |        |
        |        v                                           v        |
        |   getUserMedia  --->  POST /api/voice/transcribe  run_alice.py
        |                              |                     (Threading
        |                              v                      HTTPServer)
        |                       Vosk STT engine                    |
        |                              |                           |
        |                              v                           |
        |                    assistant.handle()                    |
        |                     /            \                       |
        |            safety refusal    security intent             |
        |                     |            |                       |
        |                     v            v                       |
        |              audit log    cyber_lab tools                |
        |                              |                           |
        |                              v                           |
        |                    POST /api/voice/tts                   |
        |                       espeak-ng WAV                      |
        |                              |                           |
        |                              v                           |
        |                        <audio> playback                  |
        +-------------------------------------------------------------+
```

## Boot sequence

1. **Firmware** (BIOS or UEFI) loads GRUB from the hybrid ISO.
2. **GRUB** loads `live/vmlinuz` + `live/initrd.img` with `boot=live`.
3. **live-boot** mounts `live/filesystem.squashfs` as the read-only root and layers
   a tmpfs overlay so the running system is writable in RAM.
4. **live-config** applies `/etc/live/config.conf.d/alice.conf` (hostname `alice-os`,
   user `alice`).
5. **systemd** starts `alice-os.service` (the Python server) on `127.0.0.1:8765`.
6. **getty@tty1** autologins as `alice`; `.bash_profile` runs `startx`.
7. **.xinitrc** launches Openbox and then Chromium in `--kiosk` mode pointing at the
   local server. The desktop appears.

## Voice pipeline

The browser captures microphone audio with the Web Audio API at (or resampled to)
16 kHz mono. It converts the float samples to little-endian Int16 PCM and POSTs the
raw bytes to `/api/voice/transcribe` with an `X-Sample-Rate` header. This avoids any
dependency on `ffmpeg` or a container format.

`VoiceEngine.transcribe_pcm()` feeds the PCM to a `vosk.KaldiRecognizer` in chunks
and returns the recognized text plus word timings. The text is then routed through
`assistant.handle()`.

Responses are rendered to speech by `espeak-ng -w` into a temporary WAV, streamed
back by `/api/voice/tts`, and played through an `<audio>` element.

## Assistant brain & safety boundary

`alice_core/intelligence/assistant.py` is the command router:

1. **Refusal layer** — regex patterns block offensive/unauthorized requests
   (third-party attacks, credential theft, malware, evasion, persistence, DoS).
   Refusals are returned with `intent: "refused"` and logged.
2. **Security-intent layer** — keyword maps route natural language to defensive
   tools in `cyber_lab.py`.
3. **Delegation layer** — anything else goes to the local FRIDAY intelligence core.

Every query is appended to `data/security_events.json` with timestamp, intent,
tool, provider and whether it was refused.

## Security tools (`cyber_lab.py`)

| Tool | Scope |
|------|-------|
| System Inventory | read-only local OS/CPU/RAM/Python info |
| Local Port Audit | `ss -lntup` listening sockets only |
| Nmap Localhost | `nmap -sT 127.0.0.1` only |
| Alice Security Audit | hardening defaults + permissions |
| Python Dependency Audit | `pip-audit` when available |
| Workspace Secret Scan | regex secret detection, values redacted |
| File Integrity Hash | SHA-256 inside the workspace |
| Tool Status | availability of nmap, hashcat, sqlmap, zap, yara, clamav, tshark, semgrep, trivy, metasploit |

No exploit, payload, or remote action is ever executed.
