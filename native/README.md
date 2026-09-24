# Alice OS 11.1 Native Boundary

This directory is the native-boot integration boundary. It contains a small native init and an initramfs build path. It intentionally does not ship a Linux kernel or firmware.

`./native/BUILD_NATIVE.sh` compiles the native init and creates a test initramfs when `gcc` and `cpio` are available.

A bootable ISO requires a tested Linux kernel plus GRUB and xorriso. Those components are environment-specific and are not silently bundled or downloaded by Alice OS.
