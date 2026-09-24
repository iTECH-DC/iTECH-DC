# Alice OS 13.3 — Alice Cloud Vault

Alice Cloud is an offline-first persistence layer for the Alice desktop.

## Stores
- Owner-approved memories and notes.
- Process metadata and workflow history. API request bodies are not stored.
- Safe reminders and schedules: once, daily, or weekly.
- Schedule notifications are delivered through Alice's local notification feed.

## Privacy
- The vault is stored in `data/alice_cloud.db` on the Alice PC.
- Remote synchronization is disabled by default.
- No passwords, tokens, request bodies, or secret values are recorded in process history.
- A future remote sync adapter must require explicit owner opt-in and a trusted endpoint.

## Scheduler
The local scheduler checks every 10 seconds. It does not execute arbitrary shell commands. A due reminder creates a local Alice notification and process-history record.
