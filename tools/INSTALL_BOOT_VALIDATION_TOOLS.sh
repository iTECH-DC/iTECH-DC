#!/bin/sh
set -eu
if command -v apt-get >/dev/null 2>&1; then
  echo 'Installing Debian/Ubuntu/Parrot boot validation tools...'
  apt-get update
  apt-get install -y cpio grub-common grub-pc-bin xorriso qemu-system-x86
  exit 0
fi
if command -v pacman >/dev/null 2>&1; then
  sudo pacman -Sy --needed cpio grub xorriso qemu-desktop
  exit 0
fi
echo 'Unsupported package manager. Install: cpio, GRUB rescue tooling, xorriso, and qemu-system-x86_64.' >&2
exit 2
