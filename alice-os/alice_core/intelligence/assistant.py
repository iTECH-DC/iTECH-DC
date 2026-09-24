"""Alice OS 14.0 — Ethical Hacking Assistant Brain.

Voice/chat command router that turns natural language into safe, authorized,
local-only security operations and system actions. Every capability is
defensive and owner-authorized:

  * Network probing is restricted to 127.0.0.1 / localhost.
  * File analysis is confined to the Alice workspace.
  * No credential theft, persistence, evasion, exploitation of remote targets,
    or destructive actions are ever performed.

The assistant returns both a human-readable ``speech`` line (short, for TTS)
and a structured ``data`` payload for the UI.
"""
from __future__ import annotations

import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Intent keyword map -> canonical security tool id (from cyber_lab.TOOLS)
SECURITY_INTENTS = {
    "system_inventory": [
        "system inventory", "inventory", "recon", "reconnaissance",
        "what is this machine", "system info", "hardware info",
        "cpu usage", "cpu load", "ram usage", "memory usage", "system status",
        "how much memory", "how much ram", "disk usage", "storage usage",
        "system snapshot", "machine specs", "specs",
    ],
    "local_ports": [
        "open ports", "listening ports", "port audit", "local ports",
        "listening services", "what ports",
    ],
    "nmap_localhost": [
        "nmap", "port scan", "scan localhost", "scan my machine",
        "scan myself", "localhost scan",
    ],
    "config_audit": [
        "security audit", "hardening", "audit my config", "alice security audit",
        "check my security", "configuration audit",
    ],
    "dependency_audit": [
        "dependency audit", "pip audit", "vulnerable packages",
        "check dependencies", "supply chain",
    ],
    "secret_scan": [
        "secret scan", "scan for secrets", "find credentials", "leaked keys",
        "scan workspace", "find api keys",
    ],
    "file_hash": [
        "hash file", "file hash", "sha256", "integrity check", "checksum",
    ],
    "tool_status": [
        "tool status", "what tools", "security tools", "list tools",
        "available tools", "installed tools",
    ],
}

# Defensive refusals for disallowed (offensive/unauthorized) requests.
REFUSAL_PATTERNS = [
    (r"\b(hack|attack|exploit|ddos|dos|breach|break\s?into|get\s?into)\b.*"
     r"\b(site|website|server|network|target|someone|him|her|them|neighbor|neighbour|friend|wife|husband|"
     r"boss|coworker|colleague|classmate|school|company|business|router|wifi|wi-fi|account|email|phone|"
     r"facebook|instagram|twitter|instagram|snapchat|tiktok|bank)\b",
     "I only operate on your own authorized, local systems. I cannot help attack, access, or surveil a third party."),
    (r"\b(hack|access|break\s?into|get\s?into)\b.*\b(my\s+)?(neighbor|neighbour|friend|wife|husband|boss|"
     r"coworker|colleague|someone\s+else|somebody\s+else|other\s+people)\b",
     "I only operate on your own authorized, local systems. I cannot help attack, access, or surveil a third party."),
    (r"\b(steal|dump|exfiltrate|crack|brute\s?force|sniff|capture)\b.*"
     r"\b(password|passwords|credential|credentials|hash|hashes|account|accounts|wifi\s?password)\b",
     "I don't perform credential theft, password cracking, or traffic sniffing against live systems. I can help you audit your own password strength instead."),
    (r"\b(install|deploy|create|build|write|make)\b.*\b(malware|ransomware|backdoor|rootkit|keylogger|trojan|virus|worm|spyware)\b",
     "I won't create or deploy malware. I can help you analyse a sample safely in an isolated local lab."),
    (r"\b(bypass|evade|defeat)\b.*\b(antivirus|firewall|edr|security|authentication|login|password|2fa|mfa)\b",
     "I don't build evasion or authentication-bypass techniques. I can help you review and harden your own controls."),
    (r"\bpersistence\b",
     "I don't implement persistence mechanisms. I can help you review what legitimately auto-starts on your own PC."),
    (r"\b(ddos|denial\s+of\s+service|flood)\b",
     "I don't run denial-of-service or flooding attacks. I can help you stress-test your own service locally instead."),
]

DISCLAIMER = ("Alice runs a defensive, owner-authorized security lab. "
              "Network probes are limited to localhost and analysis stays on this device.")


def _match_security(text):
    low = text.lower()
    best = None
    best_len = 0
    for tool_id, keys in SECURITY_INTENTS.items():
        for k in keys:
            if k in low and len(k) > best_len:
                best = tool_id
                best_len = len(k)
    return best


def refusal_for(text):
    low = text.lower()
    for pattern, message in REFUSAL_PATTERNS:
        if re.search(pattern, low):
            return message
    return None


def run_security_intent(tool_id, args=None):
    """Execute a security tool through the cyber_lab module."""
    from alice_core.intelligence import cyber_lab
    args = args or {}
    if tool_id == "tool_status":
        return {"ok": True, "kind": "tool_status", "data": cyber_lab.tool_status()}
    try:
        result = cyber_lab.run_tool(tool_id, args)
        return {"ok": True, "kind": "security_tool", "tool": tool_id, "data": result}
    except Exception as exc:
        return {"ok": False, "kind": "security_tool", "tool": tool_id, "error": str(exc)}


def _summarize_security(tool_id, data):
    """Produce a short spoken summary for a security tool result."""
    try:
        if tool_id == "system_inventory":
            return (f"System inventory complete. This is {data.get('platform','unknown platform')} "
                    f"on {data.get('machine','unknown architecture')}, hostname {data.get('hostname','unknown')}.")
        if tool_id == "local_ports":
            out = (data.get("output") or "").strip()
            lines = [l for l in out.splitlines() if l.strip()]
            return f"Local port audit complete using {data.get('tool','the system tool')}. {max(0,len(lines)-1)} listening entries were reported."
        if tool_id == "nmap_localhost":
            if not data.get("ok"):
                return "Nmap is not installed, so the localhost scan could not run."
            return "Localhost scan complete. Results are shown in the workbench; only 127.0.0.1 was probed."
        if tool_id == "config_audit":
            checks = data.get("checks", [])
            passed = sum(1 for c in checks if c.get("status") == "PASS")
            return f"Security audit complete. {passed} of {len(checks)} checks passed."
        if tool_id == "dependency_audit":
            if not data.get("ok"):
                return "Dependency audit tool is not installed. No packages were changed."
            return "Python dependency audit complete. Review the report in the workbench."
        if tool_id == "secret_scan":
            n = len(data.get("findings", []))
            return f"Workspace secret scan complete. {n} potential finding(s) were detected and redacted."
        if tool_id == "file_hash":
            return f"File hashed. SHA-256 is {data.get('sha256','')[:16]}…"
        if tool_id == "tool_status":
            tools = data.get("tools", [])
            installed = sum(1 for t in tools if t.get("installed"))
            return f"Security tool status checked. {installed} of {len(tools)} tools are installed locally."
    except Exception:
        pass
    return "Security operation complete."


def handle(text, context=None, network_enabled=False, audit=None):
    """Main entry point. Returns dict with keys: ok, intent, speech, data, provider."""
    context = context or {}
    raw = str(text or "").strip()
    low = raw.lower()
    if not raw:
        return {"ok": False, "intent": "empty", "speech": "I didn't catch that. Please try again."}

    # 1) Safety boundary first.
    refusal = refusal_for(raw)
    if refusal:
        return {"ok": True, "intent": "refused", "speech": refusal, "data": {"policy": "defensive-only"}}

    # 2) Security intents.
    tool_id = _match_security(raw)
    if tool_id:
        args = {}
        m = re.search(r"hash (?:file )?([\w./-]+)", low)
        if tool_id == "file_hash" and m:
            args["path"] = m.group(1)
        result = run_security_intent(tool_id, args)
        speech = _summarize_security(tool_id, result.get("data", {})) if result.get("ok") else \
            f"That security tool could not run: {result.get('error','unknown error')}"
        result.update({"intent": "security", "speech": speech, "provider": "alice-security-assistant"})
        return result

    # 3) Delegate everything else to the local intelligence core.
    from alice_core.intelligence.core import ask as ai_ask
    try:
        ai = ai_ask(raw, context=context, network_enabled=network_enabled, audit=audit)
        speech = ai.get("answer") or "I could not produce an answer."
        return {
            "ok": True,
            "intent": "ai",
            "speech": speech,
            "answer": speech,
            "provider": ai.get("provider", "friday"),
            "data": ai.get("data", {}),
            "errors": ai.get("errors", []),
        }
    except Exception as exc:
        return {"ok": True, "intent": "unknown", "speech":
                "I can run local system and security commands, but that request isn't connected to a skill yet.",
                "errors": [str(exc)]}
