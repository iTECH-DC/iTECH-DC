#!/usr/bin/env python3
from pathlib import Path
import shutil, subprocess, sys
root=Path(__file__).resolve().parents[1]
checks=[]
def check(name, ok, detail=''):
    checks.append((name, bool(ok), detail))
check('native compiler', shutil.which('cc') is not None, shutil.which('cc') or '')
check('cpio', shutil.which('cpio') is not None, shutil.which('cpio') or '')
check('GRUB ISO builder', shutil.which('grub-mkrescue') is not None, shutil.which('grub-mkrescue') or 'not installed')
check('xorriso', shutil.which('xorriso') is not None, shutil.which('xorriso') or 'not installed')
check('QEMU x86_64', shutil.which('qemu-system-x86_64') is not None, shutil.which('qemu-system-x86_64') or 'not installed')
kernels=list(Path('/boot').glob('vmlinuz-*'))
check('Linux kernel', bool(kernels), str(kernels[-1]) if kernels else 'not found')
initrd=root/'native/build/initrd-alice.img'
check('Alice initramfs', initrd.exists() and initrd.stat().st_size>0, str(initrd))
if initrd.exists() and shutil.which('cpio'):
    p=subprocess.run(['cpio','-it'],input=initrd.read_bytes(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    listing=p.stdout.decode(errors='ignore').splitlines()
    check('PID 1 /init present','./init' in listing, 'self-contained native executable')
    check('Native alice-init present','./bin/alice-init' in listing, 'native runtime')
version=(root/'VERSION').read_text().strip()
check('Release version', version=='12.3.0', version)
for name,ok,detail in checks:
    print(('PASS' if ok else 'INFO')+' | '+name+' | '+detail)
iso_ready=all(ok for name,ok,_ in checks if name in {'native compiler','cpio','GRUB ISO builder','xorriso','QEMU x86_64','Linux kernel','Alice initramfs','PID 1 /init present','Native alice-init present','Release version'})
if not iso_ready:
    print('Boot ISO can only be called validated when GRUB/xorriso are available and QEMU completes a boot test.')
