#!/usr/bin/env bash
set -euo pipefail
if ! command -v apt-get >/dev/null 2>&1; then
  echo "This helper expects a Debian/Ubuntu/Parrot-style system with apt-get."
  exit 2
fi
sudo apt-get update
sudo apt-get install -y grub-pc-bin grub-common xorriso qemu-system-x86
printf '\nValidation tools installed. Run: tools/check_boot_environment.py\n'
