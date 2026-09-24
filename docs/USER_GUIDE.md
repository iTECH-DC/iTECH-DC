# Alice OS 14.0 — User Guide

This guide is for **using** Alice OS once it is booted. To build or write the ISO,
see [`BUILD.md`](BUILD.md).

---

## 1. Boot Alice OS

1. Write `alice-os-14.0-amd64.iso` to a USB stick (see BUILD.md → *Write to USB*).
2. Insert the USB into your second PC and power it on.
3. Open the boot menu (usually `F12`, `F9`, `Esc`, or `Del`) and pick the USB
   device. On modern PCs choose the **UEFI** entry; on older PCs the **legacy/BIOS**
   entry.
4. The GRUB menu appears. Choose **Alice OS 14.0 — Live**.
   - *verbose / debug* prints boot logs.
   - *safe graphics (nomodeset)* is for GPUs that misbehave with KMS.
5. Alice auto-logs in and the desktop appears full-screen.

Nothing is installed to your hard drive. The system runs from RAM; unplug the USB
and reboot to return to your normal OS.

---

## 2. Talk to Alice (voice)

- Click the **voice orb** in the desktop, or open **Start ▸ Alice Voice**.
- The orb animates: **ready → listening → thinking → speaking**.
- Speak naturally, then pause. Alice transcribes on-device (Vosk), thinks, and
  answers out loud (espeak-ng). The transcript appears live in the panel.

Try saying:

| Say this | What happens |
|----------|--------------|
| "What is my CPU usage?" | Reports local CPU / memory / disk |
| "Scan my local ports" | Runs a loopback port audit |
| "List security tools" | Shows the Security Workbench tool status |
| "Run a security audit" | Runs the local Alice Security Audit |
| "What are my system specs?" | Reports machine inventory |

**Controls:** continuous-listening mode keeps the mic open between turns; the
wake-word toggle makes Alice respond only after the wake word. Both are in the
voice panel.

> Voice needs a microphone. If none is detected, use the text chat box instead —
> it drives the exact same assistant.

---

## 3. Use the Security Workbench

Open **Start ▸ Security Workbench** (or `◈ Security Workbench`).

- **Tool grid** — 16 defensive tools. Click one to run it. Results stream into the
  output pane.
- **Status line** — shows how many local tools are installed and confirms the
  **localhost-only scope**.
- **Owner audit log** — every security intent, allowed or refused, is listed here.
  Use **Refresh** to reload.

### What it will and will not do

| ✅ Owner-authorized, local | ❌ Refused (and logged) |
|---------------------------|-------------------------|
| Inventory this machine | Attack a neighbor's wifi |
| Audit local open ports | Steal someone's account password |
| Hash a file for integrity | Denial-of-service a third party |
| Scan the local workspace for secrets | Any action against a system you don't own |
| Report installed security tools | — |

If you ask for something in the right-hand column, Alice explains why it won't,
and records the request in the audit log.

---

## 4. Everyday desktop

- **Start menu** (bottom-left): apps, voice, security workbench, settings.
- **Taskbar**: running windows, clock, system tray.
- **Windows**: drag, resize, minimise, maximise, close.
- **Files / terminal / settings**: available from the Start menu.

---

## 5. Where things live (inside the running OS)

| Path | Purpose |
|------|---------|
| `/opt/alice-os/` | The Alice OS application (server + UI) |
| `/opt/alice-os/ui/` | Desktop UI (HTML/CSS/JS) |
| `/opt/alice-os/voice_models/` | Offline Vosk STT model |
| `/opt/alice-os/data/` | Runtime data, settings, audit log |
| `~/.xinitrc` | Kiosk launch (X + Openbox + Chromium) |

---

## 6. Safety reminder

Alice OS is a **defensive** tool for machines **you own**. Only ever point its
security features at systems you are explicitly authorized to test. The assistant
is built to refuse and log anything else — keep it that way.
