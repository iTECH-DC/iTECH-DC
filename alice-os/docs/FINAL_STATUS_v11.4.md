# Alice OS 11.4 — Final Development Candidate

Alice OS is now packaged as a coherent desktop + native boot development candidate.

## Included
- Alice desktop and local assistant
- System Supervisor, Event Engine, Action Center and workflows
- Offline-first localhost architecture
- Owner authentication/security foundation
- Native C init layer
- Initramfs build
- x86_64 boot staging
- GRUB configuration
- Native runtime validation
- Boot environment checker
- One-command final ISO/QEMU validation script

## What remains environment-dependent
A genuinely boot-tested ISO requires these host tools:
- `grub-mkrescue`
- `xorriso`
- `qemu-system-x86_64`

Run `tools/FINALIZE_BOOT.sh` on a Linux build machine with those tools installed. It builds the native release, creates the ISO, and launches QEMU. The script intentionally refuses to claim boot validation when the tools are missing.

Do not write an unvalidated image directly to a physical disk. Validate in QEMU first, then use a separate USB test workflow while preserving the existing OS.
