# ALICE OS 11.1 — Integrated Development Release

Alice OS combines an offline-first desktop assistant, local system management, owner-controlled security, event/recommendation workflows, and a native x86_64 boot integration boundary.

## Start
- Windows: `START_ALICE.bat`
- Linux: `./START_ALICE.sh`
- Diagnostics: `CHECK_ALICE.bat`

## Security
- Local service binds to `127.0.0.1`.
- Network access is disabled by default.
- Camera, microphone, location and phone-alert features require explicit permission/configuration.
- Security tooling is restricted to defensive/local operation.
- Updates and system-changing workflows require explicit owner action.

## Native OS status
The native layer is an integration boundary, not a claim of a finished production kernel. `native/BUILD_NATIVE.sh` builds the native init and test initramfs. A real bootable ISO still requires a compatible Linux kernel, GRUB/xorriso, QEMU boot testing, and finally hardware validation on the target PC.


## v11.5 Intelligence Core
FRIDAY local-first orchestration, optional GPT/Claude adapters, and a local defensive security AI are included. Cloud AI is disabled by default; API keys are environment variables only.
