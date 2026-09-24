# Alice OS 12.0 — Verification Record

This release was rechecked from the packaged source tree before distribution.

## Passed
- Python syntax checks
- JavaScript syntax checks
- Shell syntax checks
- Alice OS release checks
- Local API integration self-test (9 API areas)
- Native C compilation
- Native PID 1 smoke test
- Native initramfs contents: `/init`, `/bin/alice-init`, `/proc`, `/sys`, `/dev`
- Native boot artifact SHA-256 verification
- First-run owner authentication setup
- Correct-password authentication
- Incorrect-password rejection
- Live HTTP serving of the main UI, CSS, JavaScript and default wallpaper
- Offline mode and loopback binding checks

## First-run behavior
`data/auth.json` is intentionally an empty JSON object. Alice creates the owner's PBKDF2-SHA256 password when the user completes first-run setup.

## Not claimed as passed
A standalone bootable ISO has not been declared validated in this environment because GRUB ISO tooling, xorriso and QEMU are unavailable here. The project includes the scripts required to build and test the ISO on a suitable Linux build machine.
