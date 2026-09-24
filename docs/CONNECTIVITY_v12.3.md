# Alice OS 12.3 — Connectivity Architecture

- Wi-Fi radio control uses NetworkManager `nmcli` when available.
- Bluetooth radio control uses `rfkill` when available.
- Airplane mode disables both radios and records their previous states for restoration.
- Wi-Fi scan is local through NetworkManager.
- Wi-Fi connection accepts an SSID/password from the owner and Alice does not persist the password.
- Alice application-level network access remains separate from physical radio state.
- No remote scanning or tracking is performed.
- Missing host tools are reported as unavailable rather than simulated.
