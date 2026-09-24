# Alice OS 13.4 — Encrypted Cloud Sync

Alice Cloud remains local-first. 13.4 adds optional client-side encrypted synchronization.

- Data is encrypted on the Alice device with a passphrase-derived Fernet key.
- The remote relay stores opaque ciphertext only.
- The encryption passphrase is never sent to the relay.
- Access uses an owner-configured bearer token.
- Sync is disabled by default.
- Push increments a server revision.
- Pull previews remote data first; replacing local data requires an explicit `apply` request.
- The relay should be deployed behind HTTPS and protected with a strong token.
- Passwords, authentication secrets and request bodies are not included in cloud snapshots.

Relay:
`ALICE_CLOUD_TOKEN=<strong-random-token> python3 alice_cloud_server.py`

Client endpoint should point to the relay base URL. Production deployments should use HTTPS.
