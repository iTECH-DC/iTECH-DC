# Alice OS 11.1 — Native Boot Validation

This release moves the native layer closer to real PC boot testing.

## Included
- Native `alice-init` compilation.
- Test initramfs generation.
- Host-kernel discovery.
- Boot staging directory with GRUB configuration.
- Explicit ISO builder.

## Safety and reproducibility
Alice OS does not silently download kernels, firmware, GRUB, or other privileged system components. The ISO builder uses tools already installed on the build machine.

A generated staging area is **not** the same as a proven bootable OS. Boot testing must be performed in QEMU or on a test PC before replacing an existing operating system.

## Commands

```sh
./tools/build_native_release.sh
./tools/build_iso.sh
```

If GRUB/xorriso are unavailable, `build_iso.sh` stops after producing the boot staging directory and reports exactly what is missing.
