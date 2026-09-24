# Alice OS 12.9 — Ethical Security Lab

Alice's Intelligence Core now has a defensive, owner-authorized security toolbox.

## Included
- System Inventory — read-only local system information
- Local Port Audit — listening services on this PC
- Nmap Localhost — Nmap against `127.0.0.1` only
- Alice Security Audit — local configuration/hardening checks
- Python Dependency Audit — `pip-audit` if installed; no automatic installation
- Workspace Secret Scan — detects likely credential patterns and redacts values
- File Integrity Hash — SHA-256 for files inside the Alice workspace

## Scope
Network probing is strictly limited to localhost. File analysis is confined to the Alice workspace. Alice does not provide remote-target scanning, credential theft, persistence, evasion, destructive actions, or exploitation workflows.
