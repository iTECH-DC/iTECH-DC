# Alice OS 11.8 — Release Hardening

This release keeps the restored original PC desktop and hardens the development package.

## Changes
- Release/version checks now validate 11.8.0 consistently.
- Native PID 1 version string updated to 11.8.
- Rebuilt native initramfs from the current native source.
- Removed an unnecessary monitor configuration no-op.
- Existing offline-first, localhost-only desktop behavior is retained.
- Boot validation remains honest: an ISO is not considered boot-validated unless GRUB/xorriso are installed and QEMU completes a boot test.

## Safety
Alice OS does not silently enable camera, microphone, location, network AI, remote control, or destructive system actions. Sensitive features remain owner-controlled and permission-gated.
