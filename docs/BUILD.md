# Building the Alice OS 14.0 ISO

## Prerequisites (build host)

Debian 12 or Ubuntu 22.04+ with root/sudo and ~4 GB of free disk.

```bash
sudo apt-get update
sudo apt-get install -y \
  debootstrap squashfs-tools xorriso \
  grub-pc-bin grub-efi-amd64-bin grub-common \
  mtools dosfstools isolinux syslinux-common syslinux-efi \
  cpio rsync
```

## Step 1 — Build the Debian rootfs

```bash
bash iso-build/install_chroot.sh
```

This runs `debootstrap --variant=minbase bookworm` into `iso-build/chroot` and
installs the kernel, live-boot/live-config, Xorg + Openbox, Chromium, Python 3,
espeak-ng, NetworkManager and firmware.

## Step 2 — Install the Alice OS payload

```bash
bash iso-build/copy_payload.sh
```

This copies the application to `/opt/alice-os`, installs the systemd units,
autologin override, kiosk `.xinitrc`, console banner and sudoers rule, creates the
`alice` user, and installs `vosk` into the system Python.

## Step 3 — Build the ISO

```bash
bash iso-build/build_iso.sh
```

This shrinks the rootfs, builds `filesystem.squashfs` with xz compression, copies
the kernel and initrd, writes `grub.cfg`, and runs `grub-mkrescue` to produce a
**hybrid BIOS + UEFI** ISO at:

```
iso-build/alice-os-14.0-amd64.iso
```

## Step 4 — Test in QEMU (optional)

```bash
sudo apt-get install -y qemu-system-x86 ovmf
# BIOS boot
qemu-system-x86_64 -m 2048 -cdrom iso-build/alice-os-14.0-amd64.iso
# UEFI boot
qemu-system-x86_64 -m 2048 -bios /usr/share/ovmf/OVMF.fd \
  -cdrom iso-build/alice-os-14.0-amd64.iso
```

## Step 5 — Write to USB

```bash
sudo dd if=iso-build/alice-os-14.0-amd64.iso of=/dev/sdX bs=4M status=progress oflag=sync
```

> Double-check `/dev/sdX`. Writing to the wrong device destroys data.

## Notes

- The live system runs from RAM (tmpfs overlay). Changes are not persisted unless
  you add a persistence partition.
- The default owner password for the live user is `alice`. Change it after first
  boot (`passwd`).
- The assistant server binds only to `127.0.0.1`; nothing is exposed on the network.
