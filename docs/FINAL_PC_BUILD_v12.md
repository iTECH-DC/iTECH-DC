# Alice OS 12.0 — PC Build / Release Candidate

Alice OS 12.0 consolidates the original PC desktop experience with the local intelligence, security, system-management, and native boot foundation built through the project.

## What is validated in this release
- Original PC-style Alice desktop UI retained.
- Python backend and JavaScript UI syntax checks.
- Native C initialization layer compilation.
- Alice native initramfs generation.
- Self-contained native `/init` and `alice-init` artifacts.
- Local API integration self-test.
- Offline-first mode and localhost binding.
- Security/permission controls remain owner-controlled.
- Boot staging and GRUB configuration generation.

## What still requires a suitable Linux build/QA machine
The final physical-PC milestone requires `grub-mkrescue`, `xorriso`, and `qemu-system-x86_64`. Those tools are not available in the current build environment, so no claim is made that an ISO has booted successfully.

Run on Debian/Ubuntu/Parrot:

```bash
sudo ./tools/INSTALL_BOOT_VALIDATION_TOOLS.sh
./tools/FINALIZE_BOOT.sh
```

The finalizer builds the native artifacts, creates the ISO, and starts QEMU with serial output. A successful QEMU boot should be recorded before calling the ISO boot-validated.

## Local integration test

```bash
python3 tools/self_test.py
```

This test starts Alice on `127.0.0.1`, checks core local APIs, verifies offline state, and confirms native boot artifacts.

## Safety model
Alice OS does not silently install software, scan remote targets, capture camera data, track location, or send data to a phone. Those capabilities remain permission-based and owner-controlled. Security analysis is defensive and local-first.
