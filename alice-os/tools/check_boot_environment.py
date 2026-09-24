#!/usr/bin/env python3
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
for name, cmd in [('C compiler','cc'),('GRUB ISO builder','grub-mkrescue'),('xorriso','xorriso'),('QEMU x86_64','qemu-system-x86_64')]:
    found=shutil.which(cmd)
    print(f"{'PASS' if found else 'INFO'} | {name} | {found or 'not installed'}")
print('This checker never claims a boot test unless QEMU actually completes one.')
