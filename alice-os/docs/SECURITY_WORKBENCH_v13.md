# Alice OS 13.0 — Security Workbench

Alice OS 13.0 turns the defensive security catalog into a first-class Security Workbench.

## Areas
- Recon: local inventory, localhost service audit, Nmap localhost
- Web security: authorized lab status for sqlmap and OWASP ZAP
- Code/supply chain: Semgrep, pip-audit, Trivy availability
- Malware/forensics: YARA, ClamAV, SHA-256 hashing
- Network analysis: TShark/PCAP analysis support
- Password auditing: Hashcat availability for authorized offline datasets
- Authorized lab: Metasploit availability check only; no automatic exploit or payload execution

## Safety boundary
Network probing is restricted to 127.0.0.1 in the bundled active scanner. Other tools are exposed as availability/status checks unless a dedicated local-lab integration is explicitly implemented. Alice does not provide credential theft, persistence, evasion, destructive actions, or unauthorized remote exploitation.

## Runtime
`GET /api/security/tools` returns the catalog.
`GET /api/security/tool-status` checks locally installed security tooling without installing anything.
`POST /api/security/tool` executes only the explicitly implemented defensive tool adapters.
