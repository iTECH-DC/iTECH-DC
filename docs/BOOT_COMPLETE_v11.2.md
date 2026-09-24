# Alice OS 11.2 — Boot-Ready Development Release

This release makes the native initramfs PID 1 persistent instead of exiting immediately, builds a reproducible boot staging bundle, and provides an environment readiness check.

## What is validated here
- Native C compilation.
- Initramfs generation.
- Boot staging with a detected Linux kernel.
- GRUB configuration generation.
- SHA-256 manifest for boot artifacts.

## What is not claimed
A bootable ISO is not claimed unless `grub-mkrescue` and `xorriso` are installed and the resulting image is actually boot-tested in QEMU. This environment does not currently provide those tools, so the final ISO/QEMU step remains an external build/test step.

## Build
```sh
./tools/build_boot_bundle.sh
./tools/check_boot_readiness.py
./tools/build_iso.sh
```

For a different kernel:
```sh
ALICE_KERNEL=/path/to/vmlinuz ./tools/build_boot_bundle.sh
```

Do not overwrite an existing PC installation. Test the generated image in QEMU first, then use a separate test machine/USB.
