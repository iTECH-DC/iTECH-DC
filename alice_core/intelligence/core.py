"""Alice OS Intelligence Core 13.6 — online/offline parity.

Local-first FRIDAY orchestration with optional GPT/Claude providers.

Behaviour (the "parity" contract):
  * When Alice is **online** and an API key is configured, Alice runs *directly*
    with AI — no extra toggles required (auto-online mode, on by default).
  * When Alice is **offline** (or no key is configured), it answers with the
    local Offline Brain so the assistant stays useful instead of returning a stub.

Cloud calls remain owner-controllable: auto-online mode can be turned off, in
which case the explicit `network_ai_enabled` toggle is required. API keys are
read only from environment variables and are never written to Alice config.
The security advisor is intentionally defensive/local-only.
"""
from __future__ import annotations
import json, os, urllib.request, urllib.error, time
from pathlib import Path

from . import offline_brain

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
CONFIG_FILE = DATA / "ai_core.json"

DEFAULTS = {
    "network_ai_enabled": False,
    "auto_online_ai": True,
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
    cur["auto_online_ai"]=bool(cur["auto_online_ai"])
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

def _keys_present():
    return {"openai": bool(os.getenv("OPENAI_API_KEY")), "anthropic": bool(os.getenv("ANTHROPIC_API_KEY"))}

def resolve_online(network_enabled=False, quality=None):
    """Decide whether Alice is effectively online for AI purposes.

    `quality` is the network-quality string from the network subsystem
    ("online", "moderate", "offline"). When not supplied we fall back to the
    raw network permission flag.
    """
    if quality is None:
        return bool(network_enabled)
    return bool(network_enabled) and str(quality).lower() in {"online", "moderate"}

def effective_mode(network_enabled=False, quality=None):
    """Return the effective AI mode: 'online-ai', 'online-local', or 'offline-local'."""
    c=config(); keys=_keys_present()
    online=resolve_online(network_enabled, quality)
    cloud_allowed = c["auto_online_ai"] or c["network_ai_enabled"]
    provider_ready = (c["openai_enabled"] and keys["openai"]) or (c["anthropic_enabled"] and keys["anthropic"])
    if online and cloud_allowed and provider_ready:
        return "online-ai"
    if online:
        return "online-local"
    return "offline-local"

def provider_status(network_enabled=False, quality=None):
    c=config(); keys=_keys_present()
    online=resolve_online(network_enabled, quality)
    mode=effective_mode(network_enabled, quality)
    cloud_allowed = c["auto_online_ai"] or c["network_ai_enabled"]
    provider_ready = (c["openai_enabled"] and keys["openai"]) or (c["anthropic_enabled"] and keys["anthropic"])
    return {
        "ok":True,
        "friday":{"enabled":c["friday_enabled"],"mode":"local-first"},
        "network_ai_enabled":c["network_ai_enabled"],
        "auto_online_ai":c["auto_online_ai"],
        "network_access":bool(network_enabled),
        "online":online,
        "quality":quality or ("online" if network_enabled else "offline"),
        "cloud_ready":bool(cloud_allowed and online and provider_ready),
        "cloud_allowed":bool(cloud_allowed),
        "provider_ready":bool(provider_ready),
        "mode":mode,
        "parity":True,
        "gpt":{"enabled":c["openai_enabled"],"configured":keys["openai"],"model":c["openai_model"]},
        "claude":{"enabled":c["anthropic_enabled"],"configured":keys["anthropic"],"model":c["anthropic_model"]},
        "security_ai":{"enabled":c["security_ai_enabled"],"mode":"defensive-local-audit","cloud_model":c["security_model"],"cloud_configured":keys["openai"]},
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
        if x.get("status")!="PASS": recs.append(f"Review: {x.get('name','security check')} \u2014 {x.get('detail','check reported a warning')}.")
    if not recs: recs.append("Local defensive audit passed. Keep owner authentication enabled and review security events periodically.")
    return {"mode":"defensive-local-audit","passed":passed,"warnings":warnings,"recommendations":recs,"scope":"localhost/Alice OS configuration only"}

def _local_answer(prompt, context, audit, reason):
    """Produce a local-brain answer with parity metadata."""
    brain=offline_brain.think(prompt, context)
    return {
        "ok":True,
        "provider":"offline-brain",
        "engine":"offline-brain",
        "mode":"offline-local",
        "answer":brain.get("answer",""),
        "topic":brain.get("topic"),
        "confidence":brain.get("confidence"),
        "parity":True,
        "note":reason,
    }

def ask(prompt, context=None, network_enabled=False, audit=None, quality=None):
    c=config(); prompt=str(prompt or "").strip()
    online=resolve_online(network_enabled, quality)
    mode=effective_mode(network_enabled, quality)
    if not prompt:
        return {"ok":False,"provider":"friday","mode":mode,"answer":"Please enter a question."}
    low=prompt.lower()
    # Security requests always use the local defensive analyzer first.
    security_request=any(k in low for k in ("security audit","security review","pentest","penetration test","vulnerability","secure my pc","security test"))
    if c["security_ai_enabled"] and security_request:
        review=defensive_security_review(audit or {})
        # Local review is always performed first. Optional cloud analysis adds explanation only.
        if online and (c["auto_online_ai"] or c["network_ai_enabled"]) and os.getenv("OPENAI_API_KEY"):
            try:
                cloud=ask_security_cloud(prompt, "You are Alice OS Security AI.", c)
                return {"ok":True,"provider":"security-ai","mode":"online-ai","answer":cloud,"data":review,"parity":True}
            except Exception as e:
                return {"ok":True,"provider":"defensive-security-ai","mode":mode,"answer":"Local defensive security review complete. Cloud Security AI was unavailable, so no remote action was attempted.","data":review,"errors":[str(e)],"parity":True}
        return {"ok":True,"provider":"defensive-security-ai","mode":mode,"answer":"Local defensive security review complete. No remote target was scanned and no offensive action was executed.","data":review,"parity":True}

    # When online with a configured provider, run directly with AI.
    if mode=="online-ai":
        system=("You are FRIDAY, the orchestration layer inside Alice OS. Be concise, practical, and transparent. "
                "Never claim an action happened unless Alice reports it. For system changes, require owner approval. "
                "For cybersecurity, stay defensive and authorized: analyze local audit data, configuration, logs, or localhost lab results; do not provide instructions for unauthorized access or remote targeting. "
                "Respect Alice OS offline-first and permission controls.")
        errors=[]
        wants_code=any(k in low for k in ("code","python","javascript","program","debug","build"))
        providers=[]
        if c["routing_mode"]=="friday-smart":
            if wants_code and c["anthropic_enabled"] and os.getenv("ANTHROPIC_API_KEY"): providers.append(("claude",ask_claude))
            if c["openai_enabled"] and os.getenv("OPENAI_API_KEY"): providers.append(("gpt",ask_openai))
            if c["anthropic_enabled"] and os.getenv("ANTHROPIC_API_KEY") and not any(p[0]=="claude" for p in providers): providers.append(("claude",ask_claude))
        else:
            if c["openai_enabled"] and os.getenv("OPENAI_API_KEY"): providers.append(("gpt",ask_openai))
            if c["anthropic_enabled"] and os.getenv("ANTHROPIC_API_KEY"): providers.append(("claude",ask_claude))
        for name,fn in providers:
            try:
                return {"ok":True,"provider":name,"mode":"online-ai","answer":fn(prompt,system,c),"parity":True}
            except Exception as e:
                errors.append(f"{name.upper()}: {e}")
        # Online but cloud failed -> fall back to the local brain (parity preserved).
        local=_local_answer(prompt, context, audit, "Online, but the cloud provider was unavailable; answered locally.")
        if errors: local["errors"]=errors
        return local

    # Offline (or online without a ready provider): use the local brain.
    if online:
        reason="Online, but no cloud provider is enabled/configured; answered with the local brain."
    else:
        reason="Offline — answered with Alice's local brain (no network used)."
    return _local_answer(prompt, context, audit, reason)
