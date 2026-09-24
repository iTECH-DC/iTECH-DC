# Alice OS 12.0 — Beast Mode Development Release

This release consolidates the Alice desktop, local assistant, proactive system management, event/action/workflow layers, intelligence providers, and native boot foundation.

## Major components

- Alice OS desktop UI inspired by the supplied 3:4 reference.
- Alice Assistant and FRIDAY local-first orchestration.
- Optional GPT and Claude cloud providers behind explicit Network AI controls.
- Defensive Security AI with a strict local/authorized boundary.
- System Supervisor, Event Engine, Action Center, Automation Workflows.
- Owner authentication, permissions, camera/phone-alert foundation.
- Offline-first localhost service bound to `127.0.0.1`.
- Native C PID 1 with a self-contained initramfs executable.
- x86_64 boot staging and dynamic GRUB configuration.

## Validation performed

- Python syntax: PASS
- JavaScript syntax: PASS
- Native C compilation: PASS
- Native PID 1 runtime smoke test: PASS
- Initramfs contains `/init` and `/bin/alice-init`: PASS
- Host x86_64 kernel detected: PASS
- Boot staging generated: PASS
- GRUB ISO builder: not installed in this environment
- xorriso: not installed in this environment
- QEMU x86_64: not installed in this environment

Therefore this package is a final development release, not a falsely claimed QEMU-validated ISO.

## Boot validation on a Debian/Ubuntu/Parrot-style development PC

Run:

```bash
sudo ./tools/INSTALL_BOOT_VALIDATION_TOOLS.sh
./tools/FINALIZE_BOOT.sh
```

`FINALIZE_BOOT.sh` only reports a successful boot after the actual QEMU test runs.

## AI setup

See `AI_SETUP.md`. API keys remain environment variables and are never stored in Alice JSON configuration.


## Alice OS 12.9 — Ethical Security Lab
Alice includes an owner-authorized defensive security lab. Tools are restricted to local/localhost scope and Alice workspace data. No remote target scanning, credential theft, persistence, evasion, exploitation, or destructive actions are provided.

Alice OS 13.0.0 — Security Workbench release.


## v13.1 — Network Quality Detection
- Live network indicator now reports **Online (green)**, **Moderate (yellow)**, or **Offline (red)**.
- Uses local adapter/address detection plus a short HTTPS reachability probe when Alice network access is enabled.
- Shows measured latency when available.
- No remote scanning or tracking is performed.
