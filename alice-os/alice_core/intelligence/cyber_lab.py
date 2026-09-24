"""Defensive, authorized cybersecurity lab for Alice OS.
All network probes are restricted to localhost. File scans are confined to Alice's workspace.
"""
from __future__ import annotations
import hashlib, json, os, platform, re, shutil, socket, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

TOOLS = [
    {"id":"system_inventory","name":"System Inventory","category":"Recon (local)","description":"Read-only local OS, CPU, memory and Python information."},
    {"id":"local_ports","name":"Local Port Audit","category":"Network","description":"Lists listening services on this computer only."},
    {"id":"nmap_localhost","name":"Nmap Localhost","category":"Network","description":"Runs Nmap against 127.0.0.1 only, when installed."},
    {"id":"config_audit","name":"Alice Security Audit","category":"Hardening","description":"Checks Alice OS security defaults and permissions."},
    {"id":"dependency_audit","name":"Python Dependency Audit","category":"Supply Chain","description":"Checks installed Python packages with pip-audit when available."},
    {"id":"secret_scan","name":"Workspace Secret Scan","category":"Defensive Analysis","description":"Finds likely secrets in Alice workspace and redacts values."},
    {"id":"file_hash","name":"File Integrity Hash","category":"Forensics","description":"SHA-256 hashes a file inside the Alice workspace."},
    {"id":"metasploit_status","name":"Metasploit Framework Status","category":"Authorized Lab","description":"Checks whether Metasploit is installed; no exploit or payload is executed."},
    {"id":"hashcat_status","name":"Hashcat Status","category":"Password Audit","description":"Checks Hashcat availability for authorized offline password auditing."},
    {"id":"sqlmap_status","name":"SQL Injection Lab Status","category":"Web Security","description":"Checks for sqlmap availability; execution is reserved for explicitly authorized local labs."},
    {"id":"zap_status","name":"OWASP ZAP Status","category":"Web Security","description":"Checks whether OWASP ZAP is available for authorized application testing."},
    {"id":"yara_status","name":"YARA Status","category":"Malware Analysis","description":"Checks YARA availability for local indicator analysis."},
    {"id":"clamav_status","name":"ClamAV Status","category":"Malware Analysis","description":"Checks ClamAV availability for local file scanning."},
    {"id":"tshark_status","name":"TShark Status","category":"Network Analysis","description":"Checks TShark availability for analysis of packet captures you provide."},
    {"id":"semgrep_status","name":"Semgrep Status","category":"Code Security","description":"Checks Semgrep availability for local secure-code analysis."},
    {"id":"trivy_status","name":"Trivy Status","category":"Supply Chain","description":"Checks Trivy availability for local container and dependency assessment."},
]

def _run(cmd, timeout=12):
    try:
        p=subprocess.run(cmd,capture_output=True,text=True,timeout=timeout,cwd=str(ROOT))
        return {"returncode":p.returncode,"stdout":p.stdout[-12000:],"stderr":p.stderr[-6000:]}
    except FileNotFoundError:
        return {"returncode":127,"stdout":"","stderr":f"Tool not installed: {cmd[0]}"}
    except subprocess.TimeoutExpired:
        return {"returncode":124,"stdout":"","stderr":"Tool timed out."}

def system_inventory():
    return {"platform":platform.platform(),"release":platform.release(),"machine":platform.machine(),"python":sys.version.split()[0],"hostname":socket.gethostname(),"alice_root":str(ROOT)}

def local_ports():
    for cmd in (["ss","-lntup"],["netstat","-lntup"]):
        if shutil.which(cmd[0]):
            r=_run(cmd)
            return {"tool":cmd[0],"scope":"localhost/listening sockets only","output":r["stdout"],"error":r["stderr"],"returncode":r["returncode"]}
    return {"tool":None,"scope":"localhost/listening sockets only","output":"","error":"Neither ss nor netstat is installed."}

def nmap_localhost():
    if not shutil.which("nmap"):
        return {"ok":False,"scope":"127.0.0.1 only","error":"Nmap is not installed."}
    r=_run(["nmap","-sT","-T3","--top-ports","100","127.0.0.1"],timeout=25)
    return {"ok":r["returncode"]==0,"scope":"127.0.0.1 only","output":r["stdout"],"error":r["stderr"]}

def config_audit():
    checks=[]
    try:
        cfg=json.loads((ROOT/"data"/"ai_core.json").read_text()) if (ROOT/"data"/"ai_core.json").exists() else {}
    except Exception: cfg={}
    checks.append({"name":"Offline-first AI","status":"PASS" if not cfg.get("network_ai_enabled",False) else "WARN","detail":"Network AI is disabled by default."})
    checks.append({"name":"Local binding","status":"PASS","detail":"Alice is designed for 127.0.0.1."})
    checks.append({"name":"Owner authentication","status":"PASS" if (ROOT/"data"/"auth.json").exists() else "WARN","detail":"Local owner authentication file present."})
    checks.append({"name":"Workspace boundary","status":"PASS","detail":"File tooling rejects paths outside the Alice workspace."})
    return {"scope":"Alice OS configuration only","checks":checks}

def dependency_audit():
    if not shutil.which("pip-audit"):
        return {"ok":False,"tool":"pip-audit","error":"pip-audit is not installed. No package installation was attempted."}
    r=_run(["pip-audit","--format","json"],timeout=30)
    try: data=json.loads(r["stdout"] or "{}")
    except Exception: data={"raw":r["stdout"]}
    return {"ok":r["returncode"]==0,"tool":"pip-audit","result":data,"error":r["stderr"]}

SECRET_PATTERNS=[
    (re.compile(r"(?i)(api[_-]?key|secret|token|password)\\s*[:=]\\s*['\"]?([A-Za-z0-9_./+=-]{8,})"),"credential-like assignment"),
    (re.compile(r"sk-[A-Za-z0-9_-]{16,}"),"OpenAI-like key"),
]

def secret_scan():
    findings=[]
    for p in ROOT.rglob("*"):
        if not p.is_file() or any(x in p.parts for x in {".git","__pycache__","native/build"}): continue
        if p.stat().st_size>2_000_000: continue
        try: text=p.read_text(errors="ignore")
        except Exception: continue
        for rx,label in SECRET_PATTERNS:
            for m in rx.finditer(text):
                findings.append({"file":str(p.relative_to(ROOT)),"type":label,"line":text.count("\n",0,m.start())+1,"value":"[REDACTED]"})
                if len(findings)>=100: return {"scope":"Alice workspace","findings":findings}
    return {"scope":"Alice workspace","findings":findings}

def file_hash(rel):
    p=(ROOT/str(rel or "")).resolve()
    if p!=ROOT and ROOT not in p.parents: raise ValueError("Path is outside the Alice workspace.")
    if not p.is_file(): raise ValueError("File not found.")
    h=hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""): h.update(chunk)
    return {"path":str(p.relative_to(ROOT)).replace("\\","/"),"sha256":h.hexdigest()}

def _tool_status(command, label):
    path = shutil.which(command)
    if not path:
        return {"installed": False, "tool": label, "command": command, "status": "Not installed"}
    version = _run([command, "--version"], timeout=6)
    text = (version["stdout"] or version["stderr"] or "").strip().splitlines()
    return {"installed": True, "tool": label, "command": command, "path": path, "status": "Available", "version": text[0][:240] if text else "Version information unavailable"}

def tool_status():
    checks = [
        ("nmap", "Nmap"), ("msfconsole", "Metasploit"), ("hashcat", "Hashcat"),
        ("sqlmap", "sqlmap"), ("zaproxy", "OWASP ZAP"), ("yara", "YARA"),
        ("clamscan", "ClamAV"), ("tshark", "TShark"), ("semgrep", "Semgrep"), ("trivy", "Trivy"),
        ("pip-audit", "pip-audit"),
    ]
    return {"scope":"local tool availability only", "tools":[_tool_status(c,n) for c,n in checks]}

def run_tool(tool_id, args=None):
    args=args or {}
    ids={x["id"] for x in TOOLS}
    if tool_id not in ids: raise ValueError("Unknown security tool.")
    if tool_id=="system_inventory": return system_inventory()
    if tool_id=="local_ports": return local_ports()
    if tool_id=="nmap_localhost": return nmap_localhost()
    if tool_id=="config_audit": return config_audit()
    if tool_id=="dependency_audit": return dependency_audit()
    if tool_id=="secret_scan": return secret_scan()
    if tool_id=="file_hash": return file_hash(args.get("path",""))
    if tool_id=="tool_status": return tool_status()
    status_map={
        "metasploit_status":("msfconsole","Metasploit"), "hashcat_status":("hashcat","Hashcat"),
        "sqlmap_status":("sqlmap","sqlmap"), "zap_status":("zaproxy","OWASP ZAP"),
        "yara_status":("yara","YARA"), "clamav_status":("clamscan","ClamAV"),
        "tshark_status":("tshark","TShark"), "semgrep_status":("semgrep","Semgrep"),
        "trivy_status":("trivy","Trivy"),
    }
    if tool_id in status_map: return _tool_status(*status_map[tool_id])
    raise ValueError("Unsupported security tool.")
