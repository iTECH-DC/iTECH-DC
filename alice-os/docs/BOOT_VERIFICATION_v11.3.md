# Alice OS 11.3 — Boot Verification & Recovery

v11.3 strengthens the native boot development path with repeatable runtime validation and explicit environment checks.

## Validated in the development environment
- Native C compilation with `cc -Wall -Wextra -O2`.
- `alice-init` starts as a long-running userspace process and handles SIGTERM/SIGINT.
- Native runtime smoke test verifies startup and clean shutdown messages.
- Release checker tracks the actual VERSION file.

## Boot tools
The ISO and QEMU stages remain environment-dependent. Use `tools/check_boot_environment.py` before attempting them.

A successful ISO build requires GRUB and xorriso. A successful boot validation requires QEMU and an actual completed guest boot.

## Recovery principle
Alice's native layer is intentionally read-only during hardware discovery. If the desktop runtime fails, boot diagnostics should preserve the existing installation and expose logs rather than modifying or deleting user data.
