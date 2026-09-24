# Start Alice OS

## Windows
Double-click **START_ALICE.bat**.

The launcher now:
- detects an already-running Alice service and reuses it;
- starts the local backend without opening duplicate browser windows;
- waits up to 30 seconds for `/api/health`;
- writes startup errors to `logs/alice.log`;
- opens `http://127.0.0.1:8765` only after the service is ready.

Use **STOP_ALICE.bat** to stop the exact Alice process recorded by `data/alice.pid`.
Use **CHECK_ALICE.bat** for local diagnostics.

## Linux
Run `./START_ALICE.sh`.

## First launch
Open **Settings → Accounts & Security** and create an owner password. The password is stored as a PBKDF2-SHA256 hash, not plain text.

## Network
Alice binds to `127.0.0.1` and starts with network access disabled. Enabling network access is an explicit local setting.

## Native OS status
The native kernel/rootfs/ISO pieces are development components. This package is not described as a production-ready bootable OS until an ISO is built and boot-tested on real hardware or QEMU.
