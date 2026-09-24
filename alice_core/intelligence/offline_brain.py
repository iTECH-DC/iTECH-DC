"""Alice OS Offline Brain — local reasoning engine for online/offline parity.

This module lets Alice answer useful questions with **no network access at all**.
It is the offline counterpart to the cloud providers (GPT/Claude). When Alice is
online it can hand off to a cloud model; when it is offline it still produces a
genuinely useful answer instead of a stub.

Design goals:
  * Deterministic, dependency-free, safe (no eval of untrusted code).
  * Transparent: every answer reports the reasoning path it used.
  * Defensive by default for security questions.
"""
from __future__ import annotations
import ast
import math
import operator
import re
import time

# ---------------------------------------------------------------------------
# Small, curated local knowledge base. Keys are matched against the question.
# Each entry: (list of trigger phrases, answer, topic label)
# ---------------------------------------------------------------------------
KNOWLEDGE = [
    (
        ["what is alice os", "about alice os", "who is alice", "what is alice", "tell me about alice"],
        "Alice OS is a local-first personal digital assistant and desktop environment. "
        "It runs entirely on your own PC, binds to 127.0.0.1, and keeps network access off "
        "by default. Alice combines a desktop shell, a local intelligence core (FRIDAY), an "
        "owner-controlled security lab, file/system management and an optional cloud AI layer "
        "that only activates when you are online and explicitly allow it.",
        "about-alice",
    ),
    (
        ["offline mode", "work offline", "without internet", "no internet", "offline parity", "online offline"],
        "Alice is designed for online/offline parity. Offline, the local brain handles system "
        "status, security review, math, definitions, planning and general reasoning. Online, "
        "Alice can additionally call a cloud model (GPT/Claude) for open-ended generation and "
        "long-form reasoning. The interface and skills stay the same either way.",
        "parity",
    ),
    (
        ["what is a firewall", "explain firewall"],
        "A firewall is a security control that filters network traffic against a set of rules, "
        "deciding which connections are allowed in or out. Host-based firewalls protect a single "
        "machine; network firewalls sit at a boundary. In Alice's defensive model you would "
        "audit your local firewall rules rather than disable them.",
        "security-concept",
    ),
    (
        ["what is encryption", "explain encryption", "how does encryption work"],
        "Encryption transforms readable data (plaintext) into an unreadable form (ciphertext) "
        "using a key, so that only holders of the correct key can reverse it. Symmetric ciphers "
        "(e.g. AES) use one shared key; asymmetric ciphers (e.g. RSA, ECC) use a public/private "
        "key pair. Alice stores owner passwords as PBKDF2-SHA256 hashes rather than reversible "
        "ciphertext.",
        "security-concept",
    ),
    (
        ["what is phishing", "explain phishing", "spot phishing"],
        "Phishing is a social-engineering attack that tricks a person into revealing credentials "
        "or running malicious content, usually via a look-alike message or site. Defensive habits: "
        "verify the sender domain, avoid clicking unexpected links, use multi-factor authentication, "
        "and never enter credentials on a page you reached from an unsolicited message.",
        "security-concept",
    ),
    (
        ["what is malware", "explain malware", "types of malware"],
        "Malware is software designed to harm or gain unauthorized access: viruses, worms, trojans, "
        "ransomware, spyware and rootkits are common categories. Defensive practice is to keep systems "
        "patched, run least-privilege accounts, scan files locally (e.g. ClamAV/YARA) and monitor for "
        "unexpected behaviour rather than attempt offensive payloads.",
        "security-concept",
    ),
    (
        ["what is a vpn", "explain vpn"],
        "A VPN (virtual private network) creates an encrypted tunnel between your device and a VPN "
        "server, hiding traffic from the local network and presenting the server's IP. It improves "
        "confidentiality on untrusted networks but is not a substitute for endpoint security.",
        "security-concept",
    ),
    (
        ["what is sql injection", "explain sql injection", "prevent sql injection"],
        "SQL injection happens when untrusted input is concatenated into a database query, letting an "
        "attacker alter its logic. The fix is parameterised queries / prepared statements, input "
        "validation and least-privilege database accounts. Alice's lab only checks whether sqlmap is "
        "installed for authorized local testing; it does not attack remote targets.",
        "security-concept",
    ),
    (
        ["what is a hash", "explain hashing", "hashing vs encryption"],
        "A cryptographic hash (e.g. SHA-256) maps data of any size to a fixed-length digest. It is "
        "one-way: you cannot recover the input. Hashing verifies integrity and stores passwords; "
        "encryption is reversible with a key. Alice uses SHA-256 for file-integrity checks.",
        "security-concept",
    ),
    (
        ["what is python", "explain python"],
        "Python is a high-level, readable programming language widely used for automation, data work, "
        "web services and scripting. Alice's own backend is written in Python and runs on the standard "
        "library, so it needs no external web framework.",
        "programming",
    ),
    (
        ["what is javascript", "explain javascript"],
        "JavaScript is the programming language of the web, running in browsers and (via Node.js) on "
        "servers. Alice's desktop UI is built with HTML, CSS and JavaScript.",
        "programming",
    ),
    (
        ["what is an api", "explain api"],
        "An API (application programming interface) is a defined contract that lets one program talk "
        "to another. Alice exposes a local JSON API on 127.0.0.1 that the desktop UI calls for system "
        "status, security tools, files and AI queries.",
        "programming",
    ),
    (
        ["what is linux", "explain linux"],
        "Linux is a family of open-source, Unix-like operating systems built around the Linux kernel. "
        "It powers most servers and many security toolchains. Alice includes a native boot foundation "
        "and runs its local service on Linux, macOS and Windows.",
        "computing",
    ),
    (
        ["what is ram", "explain ram", "difference between ram and storage"],
        "RAM is fast, volatile working memory that holds running programs and data; it is cleared when "
        "power is lost. Storage (SSD/HDD) is persistent. Alice reports both CPU, RAM and storage usage "
        "on the system dashboard.",
        "computing",
    ),
    (
        ["what is cpu", "explain cpu"],
        "The CPU (central processing unit) executes instructions for programs. Its usage percentage "
        "shows how busy the processor is; Alice reads this locally for the system monitor.",
        "computing",
    ),
    (
        ["what is dns", "explain dns"],
        "DNS (domain name system) translates human-friendly names (example.com) into IP addresses. "
        "It is often called the internet's phone book.",
        "networking",
    ),
    (
        ["what is tcp", "explain tcp", "tcp vs udp"],
        "TCP is a connection-oriented transport protocol that guarantees ordered, reliable delivery. "
        "UDP is connectionless and faster but does not guarantee delivery. Web traffic typically uses "
        "TCP (with TLS); streaming and DNS often use UDP.",
        "networking",
    ),
    (
        ["what is https", "explain https", "http vs https"],
        "HTTPS is HTTP carried over TLS, encrypting traffic between client and server and authenticating "
        "the server with a certificate. Always prefer HTTPS; Alice requires HTTPS for its optional phone "
        "alert webhook.",
        "networking",
    ),
    (
        ["what is zero trust", "explain zero trust"],
        "Zero trust is a security model that assumes no implicit trust based on network location: every "
        "request is authenticated, authorized and encrypted. It replaces 'trusted inside the perimeter' "
        "with continuous verification.",
        "security-concept",
    ),
    (
        ["what is multi factor", "what is mfa", "explain mfa", "two factor"],
        "Multi-factor authentication (MFA) requires two or more independent proofs of identity — something "
        "you know, have, or are. It dramatically reduces the impact of stolen passwords and is one of the "
        "highest-value defensive controls.",
        "security-concept",
    ),
    (
        ["how do i stay safe online", "security tips", "protect myself online", "online safety"],
        "Practical online-safety habits: keep software patched, use a password manager and unique "
        "passwords, enable MFA, prefer HTTPS, be sceptical of unsolicited links and attachments, back up "
        "important data offline, and follow least-privilege for accounts. Alice can run a local defensive "
        "audit of your own configuration from the Security Workbench.",
        "security-guidance",
    ),
    (
        ["what can you do", "your capabilities", "what are your skills", "help me"],
        "Offline I can: report system/CPU/RAM/storage status, run a local defensive security review, "
        "explain security and computing concepts, do math and unit conversions, tell the time/date, "
        "manage local notes and memory, describe Alice's skills, and reason step by step about a problem. "
        "Online I can additionally call a cloud model for open-ended writing and deep reasoning.",
        "capabilities",
    ),
]

# Concept glossary for "what is X" style fallbacks.
GLOSSARY = {
    "algorithm": "a finite, ordered set of steps that transforms an input into an output.",
    "protocol": "an agreed set of rules that lets systems communicate reliably.",
    "packet": "a small unit of data sent across a network, containing headers and a payload.",
    "port": "a numbered endpoint on a host that identifies a network service (e.g. 443 for HTTPS).",
    "loopback": "the special address 127.0.0.1 that always refers to the local machine.",
    "sandbox": "an isolated environment that limits what code can access, reducing risk.",
    "token": "a piece of data representing authority, such as an API key or session credential.",
    "certificate": "a signed document binding a public key to an identity, used in TLS.",
    "vulnerability": "a weakness that could be exploited to compromise a system.",
    "exploit": "code or a technique that takes advantage of a vulnerability.",
    "patch": "a software update that fixes bugs or security flaws.",
    "backup": "a copy of data kept so it can be restored after loss or corruption.",
    "firewall": "a control that filters network traffic by rules.",
    "kernel": "the core of an operating system that manages hardware and processes.",
    "byte": "a unit of digital information, typically eight bits.",
    "bit": "the smallest unit of digital information, a 0 or 1.",
}

# Safe arithmetic operators (no eval of arbitrary code).
_OPS = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
    ast.Div: operator.truediv, ast.FloorDiv: operator.floordiv, ast.Mod: operator.mod,
    ast.Pow: operator.pow, ast.USub: operator.neg, ast.UAdd: operator.pos,
}
_ALLOWED_NAMES = {"pi": math.pi, "e": math.e, "tau": math.tau}
_ALLOWED_FUNCS = {
    "sqrt": math.sqrt, "sin": math.sin, "cos": math.cos, "tan": math.tan,
    "log": math.log, "log10": math.log10, "abs": abs, "round": round,
    "floor": math.floor, "ceil": math.ceil, "exp": math.exp,
}

_UNIT_FACTORS = {
    "km": 1000.0, "m": 1.0, "cm": 0.01, "mm": 0.001, "mi": 1609.344, "ft": 0.3048, "in": 0.0254,
    "kg": 1.0, "g": 0.001, "lb": 0.45359237, "oz": 0.028349523125,
    "gb": 1024.0, "mb": 1.0, "kb": 1.0 / 1024.0, "tb": 1024.0 * 1024.0,
}


def _safe_eval(node):
    if isinstance(node, ast.Expression):
        return _safe_eval(node.body)
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise ValueError("Only numeric constants are allowed.")
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_safe_eval(node.left), _safe_eval(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_safe_eval(node.operand))
    if isinstance(node, ast.Name) and node.id in _ALLOWED_NAMES:
        return _ALLOWED_NAMES[node.id]
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in _ALLOWED_FUNCS:
        return _ALLOWED_FUNCS[node.func.id](*[_safe_eval(a) for a in node.args])
    raise ValueError("Unsupported expression.")


def _try_math(text):
    """Attempt to evaluate a math expression, returning a formatted string or None."""
    cleaned = text.lower()
    for word, sym in (("plus", "+"), ("minus", "-"), ("times", "*"), ("divided by", "/"),
                      ("multiplied by", "*"), ("power of", "**"), ("x", "*")):
        cleaned = cleaned.replace(word, sym)
    cleaned = cleaned.replace("what is", "").replace("calculate", "").replace("compute", "").replace("=", "")
    cleaned = cleaned.replace("^", "**").strip()
    if not re.fullmatch(r"[0-9eE\.\+\-\*/%\(\)\s\*]+", cleaned or ""):
        return None
    if not re.search(r"[0-9]", cleaned) or not re.search(r"[\+\-\*/%]", cleaned):
        return None
    try:
        tree = ast.parse(cleaned, mode="eval")
        value = _safe_eval(tree)
    except Exception:
        return None
    if isinstance(value, float):
        if value.is_integer():
            value = int(value)
        else:
            value = round(value, 10)
    return f"{cleaned.strip()} = {value}"


def _try_unit_conversion(text):
    m = re.search(r"(-?\d+(?:\.\d+)?)\s*([a-z]{1,3})\s*(?:to|in|into)\s*([a-z]{1,3})", text.lower())
    if not m:
        return None
    value, src, dst = float(m.group(1)), m.group(2), m.group(3)
    if src in _UNIT_FACTORS and dst in _UNIT_FACTORS:
        result = value * _UNIT_FACTORS[src] / _UNIT_FACTORS[dst]
        return f"{value:g} {src} = {round(result, 6):g} {dst}"
    return None


def _match_knowledge(low):
    best = None
    for triggers, answer, topic in KNOWLEDGE:
        for t in triggers:
            if t in low:
                score = len(t)
                if best is None or score > best[0]:
                    best = (score, answer, topic)
    return best


def think(prompt, context=None):
    """Return a local answer dict: {answer, topic, engine, confidence}."""
    raw = str(prompt or "").strip()
    low = raw.lower()
    context = context or {}

    if not raw:
        return {"answer": "Ask me anything — I can reason locally even with no network.",
                "topic": "empty", "engine": "offline-brain", "confidence": 0.0}

    # 1) Greetings / social.
    if re.fullmatch(r"(hi|hello|hey|yo|good (morning|afternoon|evening))[\s!.,]*", low):
        return {"answer": "Hello. I'm running fully offline right now, but I can still help with your "
                          "system, security, math, definitions and planning. What do you need?",
                "topic": "greeting", "engine": "offline-brain", "confidence": 0.9}
    if low in {"thanks", "thank you", "thx", "cheers"}:
        return {"answer": "You're welcome. I'm here whenever you need me — online or offline.",
                "topic": "thanks", "engine": "offline-brain", "confidence": 0.9}

    # 2) Time / date.
    if low in {"time", "what time is it", "current time"}:
        return {"answer": time.strftime("The local time is %H:%M:%S."),
                "topic": "time", "engine": "offline-brain", "confidence": 1.0}
    if low in {"date", "what is today's date", "today's date", "what day is it"}:
        return {"answer": time.strftime("Today's date is %A, %d %B %Y."),
                "topic": "date", "engine": "offline-brain", "confidence": 1.0}

    # 3) Unit conversion, then math.
    conv = _try_unit_conversion(raw)
    if conv:
        return {"answer": conv, "topic": "conversion", "engine": "offline-brain", "confidence": 0.95}
    math_result = _try_math(raw)
    if math_result:
        return {"answer": math_result, "topic": "math", "engine": "offline-brain", "confidence": 0.95}

    # 4) Curated knowledge base.
    hit = _match_knowledge(low)
    if hit:
        return {"answer": hit[1], "topic": hit[2], "engine": "offline-brain", "confidence": 0.85}

    # 5) "What is X" glossary fallback.
    m = re.search(r"(?:what is|what's|define|explain)\s+(?:an?\s+)?([a-z0-9 \-]{2,40})", low)
    if m:
        term = m.group(1).strip().rstrip("?.")
        for key, definition in GLOSSARY.items():
            if key in term:
                return {"answer": f"{key.capitalize()}: {definition}",
                        "topic": "glossary", "engine": "offline-brain", "confidence": 0.7}

    # 6) System/status style prompts get a helpful pointer to local skills.
    if any(k in low for k in ("system", "status", "cpu", "ram", "storage", "security", "event", "recommend")):
        return {"answer": "I can report that from local data. Try 'system status', 'security status', "
                          "'recent events' or 'recommendations' and I'll read it straight from this PC.",
                "topic": "local-skill-hint", "engine": "offline-brain", "confidence": 0.6}

    # 7) Honest, useful fallback that still adds value offline.
    return {
        "answer": ("I'm offline, so I'm using Alice's local brain rather than a cloud model. "
                   "I can help with system status, a defensive security review, math, unit conversions, "
                   "definitions of computing/security terms, and step-by-step planning. "
                   "For open-ended writing or deep reasoning, connect to the internet and I'll use AI directly."),
        "topic": "offline-fallback",
        "engine": "offline-brain",
        "confidence": 0.3,
    }
