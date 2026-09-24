"""Alice OS Intelligence Core 11.5.

Local-first FRIDAY orchestration with optional GPT/Claude providers.
Cloud calls are disabled by default and require the owner to enable network AI
and Alice network access. API keys are read only from environment variables.
The security advisor is intentionally defensive/local-only.
"""
from __future__ import annotations
import json, os, urllib.request, urllib.error, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
CONFIG_FILE = DATA / "ai_core.json"

DEFAULTS = {
    "network_ai_enabled": False,
    "openai_enabled": False,
    "anthropic_enabled": False,
    "security_ai_enabled": True,
    "friday_enabled": True,
    "openai_model": "gpt-5.6-luna",
    "anthropic_model": "claude-sonnet-5",
    "security_model": "gpt-5.6-cyber",
    "routing_mode": "friday-smart",
    "timeout_seconds": 24,
}

def config():
    try:
        data=json.loads(CONFIG_FILE.read_text(encoding="utf-8")) if CONFIG_FILE.exists() else {}
        return {**DEFAULTS, **(data if isinstance(data,dict) else {})}
    except Exception:
        return dict(DEFAULTS)

def save_config(incoming):
    cur=config()
    if isinstance(incoming,dict):
        for k in DEFAULTS:
            if k in incoming:
                cur[k]=incoming[k]
    cur["network_ai_enabled"]=bool(cur["network_ai_enabled"])
    cur["openai_enabled"]=bool(cur["openai_enabled"])
    cur["anthropic_enabled"]=bool(cur["anthropic_enabled"])
    cur["security_ai_enabled"]=bool(cur["security_ai_enabled"])
    cur["friday_enabled"]=bool(cur["friday_enabled"])
    cur["openai_model"]=str(cur["openai_model"] or DEFAULTS["openai_model"])[:100]
    cur["anthropic_model"]=str(cur["anthropic_model"] or DEFAULTS["anthropic_model"])[:100]
    cur["security_model"]=str(cur["security_model"] or DEFAULTS["security_model"])[:100]
    cur["routing_mode"]=str(cur["routing_mode"] or DEFAULTS["routing_mode"])[:40]
    DATA.mkdir(parents=True,exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(cur,indent=2),encoding="utf-8")
    return cur

def provider_status(network_enabled=False):
    c=config()
    return {
        "ok":True,
        "friday":{"enabled":c["friday_enabled"],"mode":"local-first"},
        "network_ai_enabled":c["network_ai_enabled"],
        "network_access":bool(network_enabled),
        "cloud_ready":bool(c["network_ai_enabled"] and network_enabled),
        "gpt":{"enabled":c["openai_enabled"],"configured":bool(os.getenv("OPENAI_API_KEY")),"model":c["openai_model"]},
        "claude":{"enabled":c["anthropic_enabled"],"configured":bool(os.getenv("ANTHROPIC_API_KEY")),"model":c["anthropic_model"]},
        "security_ai":{"enabled":c["security_ai_enabled"],"mode":"defensive-local-audit","cloud_model":c["security_model"],"cloud_configured":bool(os.getenv("OPENAI_API_KEY"))},
        "routing_mode":c["routing_mode"],
        "keys_stored":False,
    }

def _http_json(url, headers, payload, timeout):
    body=json.dumps(payload).encode("utf-8")
    req=urllib.request.Request(url,data=body,headers={**headers,"Content-Type":"application/json"},method="POST")
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))

def _openai_text(data):
    if isinstance(data,dict) and isinstance(data.get("output_text"),str):
        return data["output_text"].strip()
    out=[]
    for item in (data.get("output",[]) if isinstance(data,dict) else []):
        for content in (item.get("content",[]) if isinstance(item,dict) else []):
            if isinstance(content,dict) and isinstance(content.get("text"),str): out.append(content["text"])
    return "\n".join(out).strip()

def ask_openai(prompt, system, c):
    key=os.getenv("OPENAI_API_KEY")
    if not key: raise RuntimeError("OPENAI_API_KEY is not configured.")
    data=_http_json("https://api.openai.com/v1/responses",{"Authorization":f"Bearer {key}"},{"model":c["openai_model"],"input":[{"role":"system","content":[{"type":"input_text","text":system}]},{"role":"user","content":[{"type":"input_text","text":prompt}]}]},int(c["timeout_seconds"]))
    text=_openai_text(data)
    if not text: raise RuntimeError("GPT returned no text output.")
    return text

def _anthropic_text(data):
    parts=[]
    for block in (data.get("content",[]) if isinstance(data,dict) else []):
        if isinstance(block,dict) and block.get("type")=="text": parts.append(str(block.get("text","")))
    return "\n".join(parts).strip()

def ask_claude(prompt, system, c):
    key=os.getenv("ANTHROPIC_API_KEY")
    if not key: raise RuntimeError("ANTHROPIC_API_KEY is not configured.")
    data=_http_json("https://api.anthropic.com/v1/messages",{"x-api-key":key,"anthropic-version":"2023-06-01"},{"model":c["anthropic_model"],"max_tokens":1200,"system":system,"messages":[{"role":"user","content":prompt}]},int(c["timeout_seconds"]))
    text=_anthropic_text(data)
    if not text: raise RuntimeError("Claude returned no text output.")
    return text

def ask_security_cloud(prompt, system, c):
    key=os.getenv("OPENAI_API_KEY")
    if not key: raise RuntimeError("OPENAI_API_KEY is not configured.")
    security_system=(system+" You are the authorized defensive security advisor for Alice OS. Analyze only owner-provided local audit data, localhost lab results, configuration, and logs. Do not provide instructions for unauthorized access, credential theft, persistence, evasion, or remote targeting.")
    return ask_openai(prompt, security_system, {**c, "openai_model": c["security_model"]})

def defensive_security_review(audit):
    checks=(audit or {}).get("checks",[]) if isinstance(audit,dict) else []
    passed=sum(1 for x in checks if x.get("status")=="PASS")
    warnings=sum(1 for x in checks if x.get("status")!="PASS")
    recs=[]
    for x in checks:
        if x.get("status")!="PASS": recs.append(f"Review: {x.get('name','security check')} — {x.get('detail','check reported a warning')}.")
    if not recs: recs.append("Local defensive audit passed. Keep owner authentication enabled and review security events periodically.")
    return {"mode":"defensive-local-audit","passed":passed,"warnings":warnings,"recommendations":recs,"scope":"localhost/Alice OS configuration only"}

def ask(prompt, context=None, network_enabled=False, audit=None):
    c=config(); prompt=str(prompt or "").strip()
    if not prompt: return {"ok":False,"provider":"friday","answer":"Please enter a question."}
    low=prompt.lower()
    # Security requests always use the local defensive analyzer first.
    security_request=any(k in low for k in ("security audit","security review","pentest","penetration test","vulnerability","secure my pc","security test"))
    if c["security_ai_enabled"] and security_request:
        review=defensive_security_review(audit or {})
        # Local review is always performed first. Optional cloud analysis adds explanation only.
        if c["network_ai_enabled"] and network_enabled and os.getenv("OPENAI_API_KEY"):
            try:
                cloud=ask_security_cloud(prompt, "You are Alice OS Security AI.", c)
                return {"ok":True,"provider":"security-ai","answer":cloud,"data":review}
            except Exception as e:
                return {"ok":True,"provider":"defensive-security-ai","answer":"Local defensive security review complete. Cloud Security AI was unavailable, so no remote action was attempted.","data":review,"errors":[str(e)]}
        return {"ok":True,"provider":"defensive-security-ai","answer":"Local defensive security review complete. No remote target was scanned and no offensive action was executed.","data":review}
    # FRIDAY remains useful offline by delegating to caller-provided local intelligence.
    if not (c["network_ai_enabled"] and network_enabled):
        return {"ok":True,"provider":"friday","answer":"FRIDAY is operating in local-first mode. Network AI is disabled, so I can use Alice's local system intelligence but not call GPT or Claude."}
    system=("You are FRIDAY, the orchestration layer inside Alice OS. Be concise, practical, and transparent. "
            "Never claim an action happened unless Alice reports it. For system changes, require owner approval. "
            "For cybersecurity, stay defensive and authorized: analyze local audit data, configuration, logs, or localhost lab results; do not provide instructions for unauthorized access or remote targeting. "
            "Respect Alice OS offline-first and permission controls.")
    errors=[]
    wants_code=any(k in low for k in ("code","python","javascript","program","debug","build"))
    providers=[]
    if c["routing_mode"]=="friday-smart":
        if wants_code and c["anthropic_enabled"]: providers.append(("claude",ask_claude))
        if c["openai_enabled"]: providers.append(("gpt",ask_openai))
        if c["anthropic_enabled"] and not any(p[0]=="claude" for p in providers): providers.append(("claude",ask_claude))
    else:
        if c["openai_enabled"]: providers.append(("gpt",ask_openai))
        if c["anthropic_enabled"]: providers.append(("claude",ask_claude))
    for name,fn in providers:
        try: return {"ok":True,"provider":name,"answer":fn(prompt,system,c)}
        except Exception as e: errors.append(f"{name.upper()}: {e}")
    return {"ok":True,"provider":"friday","answer":"FRIDAY could not use a configured cloud provider. Check network AI, provider toggles, and environment API keys.","errors":errors}
