# Alice OS 12.3 — Connectivity Release

Alice OS now includes a host-integrated connectivity architecture for Wi-Fi, Bluetooth, and Airplane mode while preserving the original PC desktop and Fluent-style icon system.

## Features
- Wi-Fi radio state detection and on/off control through NetworkManager `nmcli` when installed.
- Local Wi-Fi network discovery through NetworkManager.
- Owner-entered Wi-Fi connection workflow; Alice does not store the entered password.
- Bluetooth radio state detection and on/off control through `rfkill` when installed.
- Airplane mode disables Wi-Fi and Bluetooth and remembers their prior radio states for restoration.
- Alice application-level network permission remains separate from physical radio state.
- Quick Settings exposes Wi-Fi, Bluetooth and Airplane mode.
- Connectivity Center provides detailed status, adapters and Wi-Fi connection controls.
- Missing host radio tools are reported as unavailable rather than simulated.

## Validation
- Python syntax: PASS
- JavaScript syntax: PASS
- Release self-test: PASS (9/9 core API checks)
- Native C build: PASS
- Native initramfs: PASS
- Native PID 1 smoke test: PASS
- UI root: HTTP 200
- CSS: HTTP 200
- JavaScript: HTTP 200
- Alice logo asset: HTTP 200

## Environment limitation
This development environment does not expose a physical Wi-Fi/Bluetooth adapter and does not have `nmcli` or `rfkill`, so actual hardware radio switching cannot be claimed as tested here. On a Linux PC with those host tools installed, Alice will use the real host controls.
