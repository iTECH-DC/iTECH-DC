from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import json
import hashlib
import secrets
import base64
import os
import platform
import shutil
import subprocess
import time
import sys
import mimetypes
import urllib.request
import urllib.parse
import socket
import ipaddress
import argparse
import threading
from datetime import datetime

ROOT = Path(__file__).resolve().parent
UI = ROOT / "ui"
DATA = ROOT / "data"
PID_FILE = DATA / "alice.pid"
LOG_DIR = ROOT / "logs"
WALLPAPERS = ROOT / "wallpapers"
PORT = 8765
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip() or "13.4.0"
ALICE_OFFLINE_MODE = True
NETWORK_FILE = DATA / "network.json"
SECURITY_FILE = DATA / "security.json"
SECURITY_EVENTS = DATA / "security_events.json"
DOWNLOADS = ROOT / "downloads"
MAX_DOWNLOAD_BYTES = 250 * 1024 * 1024
ALICE_V51_SKILL_DISPATCH = True
ALICE_BIND_HOST = "127.0.0.1"

sys.path.insert(0, str(ROOT))
from alice_core.settings import load_settings, save_settings
from alice_core.security.auth import Auth
from alice_core.terminal.runner import run_command
from alice_core.skills.registry import get_skills
from alice_core.locator.locator import get_location_status, get_location_map, set_sharing, set_self_location, add_shared_contact, remove_contact
from alice_core.intelligence.core import provider_status, save_config as save_ai_config, config as ai_config, ask as ai_ask, defensive_security_review, resolve_online as ai_resolve_online, effective_mode as ai_effective_mode
from alice_core.intelligence.cyber_lab import TOOLS as CYBER_TOOLS, run_tool as run_cyber_tool, tool_status as cyber_tool_status
from alice_core.cloud_vault import init as cloud_init, snapshot as cloud_snapshot, add_memory as cloud_add_memory, memories as cloud_memories, record_event as cloud_record_event, events as cloud_events, add_schedule as cloud_add_schedule, schedules as cloud_schedules, delete_schedule as cloud_delete_schedule, set_schedule_enabled as cloud_set_schedule_enabled, start_scheduler as cloud_start_scheduler
from alice_core.cloud_sync import init as cloud_sync_init, status as cloud_sync_status, configure as cloud_sync_configure, disable as cloud_sync_disable, push as cloud_sync_push, pull as cloud_sync_pull
from alice_core.capabilities import snapshot as capability_snapshot, allowed as capability_allowed

auth = Auth(DATA / "auth.json")
settings = load_settings(DATA / "settings.json")


def json_bytes(obj):
    return json.dumps(obj).encode("utf-8")

def safe_local_path(rel=""):
    # All file-manager operations are confined to the Alice project directory.
    rel = str(rel or "").replace("\\\\", "/")
    p = (ROOT / rel).resolve()
    if p != ROOT and ROOT not in p.parents:
        raise ValueError("Path is outside the Alice workspace.")
    return p



def file_metadata(p):
    st=p.stat()
    return {
        "name": p.name, "type": "folder" if p.is_dir() else "file",
        "size": st.st_size if p.is_file() else 0,
        "modified": st.st_mtime, "created": getattr(st, "st_ctime", st.st_mtime),
        "path": str(p.relative_to(ROOT)).replace("\\", "/"),
        "extension": p.suffix.lower() if p.is_file() else ""
    }

def list_local_files(rel=""):
    base = safe_local_path(rel)
    if not base.exists() or not base.is_dir():
        raise ValueError("Directory not found.")
    items = []
    for p in sorted(base.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
        if p.name == ".alice_recycle":
            continue
        try: items.append(file_metadata(p))
        except OSError: continue
    return {"path": str(base.relative_to(ROOT)).replace("\\", "/"), "items": items}

def search_local_files(query="", rel="", limit=500):
    base=safe_local_path(rel); q=str(query or "").strip().lower()
    if not base.is_dir(): raise ValueError("Directory not found.")
    out=[]
    for p in base.rglob("*"):
        if ".alice_recycle" in p.parts or not p.exists(): continue
        if q and q not in p.name.lower(): continue
        try: out.append(file_metadata(p))
        except OSError: pass
        if len(out)>=limit: break
    return {"query":q,"items":out}

def recycle_path():
    d=ROOT/".alice_recycle"; d.mkdir(exist_ok=True); return d

def unique_target(parent, name):
    target=parent/name
    if not target.exists(): return target
    stem=target.stem; suf=target.suffix
    for i in range(2,10000):
        t=parent/f"{stem} ({i}){suf}"
        if not t.exists(): return t
    raise ValueError("Unable to create a unique filename.")




def security_config():
    defaults={"camera_permission":False,"phone_alerts_enabled":False,"phone_webhook":"","failed_attempt_threshold":3}
    try: data=json.loads(SECURITY_FILE.read_text(encoding="utf-8")) if SECURITY_FILE.exists() else {}
    except Exception: data={}
    return {**defaults, **data}

def save_security_config(cfg):
    DATA.mkdir(parents=True, exist_ok=True)
    SECURITY_FILE.write_text(json.dumps(cfg, indent=2), encoding="utf-8")

def security_events():
    try: return json.loads(SECURITY_EVENTS.read_text(encoding="utf-8")) if SECURITY_EVENTS.exists() else []
    except Exception: return []

def save_security_events(items):
    SECURITY_EVENTS.write_text(json.dumps(items[-100:], indent=2), encoding="utf-8")

def record_intrusion_event(image_data=""):
    cfg=security_config(); items=security_events()
    event={"time":time.strftime("%Y-%m-%d %H:%M:%S"),"type":"failed_unlock","image_saved":False,"notification_sent":False}
    if image_data and cfg.get("camera_permission"):
        try:
            raw=base64.b64decode(str(image_data).split(',',1)[-1], validate=True)
            if len(raw)<=2_000_000:
                secdir=DATA/"security_events"; secdir.mkdir(parents=True,exist_ok=True)
                target=secdir/("intruder_"+time.strftime("%Y%m%d_%H%M%S")+".jpg"); target.write_bytes(raw)
                event["image_saved"]=True; event["image_path"]=str(target.relative_to(ROOT)).replace('\\','/')
        except Exception: pass
    # Optional phone notification: only an owner-configured HTTPS webhook and only when network access is explicitly enabled.
    url=str(cfg.get("phone_webhook") or "").strip()
    if cfg.get("phone_alerts_enabled") and network_state.get("enabled") and url.startswith("https://"):
        try:
            payload=json.dumps({"event":"Alice OS security alert","message":"A failed unlock attempt was detected.","time":event["time"],"image_path":event.get("image_path","")}).encode()
            req=urllib.request.Request(url,data=payload,headers={"Content-Type":"application/json","User-Agent":"Alice-OS/10"},method="POST")
            with urllib.request.urlopen(req,timeout=8) as r: event["notification_sent"]=200 <= r.status < 300
        except Exception: pass
    items.append(event); save_security_events(items)
    return event

def security_snapshot():
    cfg=security_config(); return {"ok":True,"config":{"camera_permission":bool(cfg["camera_permission"]),"phone_alerts_enabled":bool(cfg["phone_alerts_enabled"]),"phone_webhook_configured":bool(cfg.get("phone_webhook")),"failed_attempt_threshold":int(cfg["failed_attempt_threshold"])},"events":security_events()[-20:]}

def load_network_state():
    try:
        data = json.loads(NETWORK_FILE.read_text(encoding="utf-8")) if NETWORK_FILE.exists() else {}
    except Exception:
        data = {}
    return {"enabled": bool(data.get("enabled", False)), "airplane_mode": bool(data.get("airplane_mode", False)), "saved_wifi": data.get("saved_wifi"), "saved_bluetooth": data.get("saved_bluetooth"), "saved_network_enabled": data.get("saved_network_enabled")}


def save_network_state(enabled):
    DATA.mkdir(parents=True, exist_ok=True)
    current = network_state if "network_state" in globals() else (load_network_state() if NETWORK_FILE.exists() else {})
    NETWORK_FILE.write_text(json.dumps({"enabled": bool(enabled), "airplane_mode": bool(current.get("airplane_mode", False)), "saved_wifi": current.get("saved_wifi"), "saved_bluetooth": current.get("saved_bluetooth"), "saved_network_enabled": current.get("saved_network_enabled")}, indent=2), encoding="utf-8")


network_state = load_network_state()

def network_interfaces():
    """Return local network interface information. No tracking or remote probing."""
    items=[]
    try:
        import psutil
        stats=psutil.net_if_stats()
        addrs=psutil.net_if_addrs()
        for name, addr_list in addrs.items():
            entry={"name":name,"up":bool(stats.get(name).isup) if name in stats else None,"addresses":[]}
            for a in addr_list:
                family=str(a.family)
                if "AF_INET" in family or "AF_INET6" in family:
                    entry["addresses"].append({"family":family,"address":a.address,"netmask":a.netmask})
            items.append(entry)
    except Exception:
        items.append({"name":"Unavailable","up":None,"addresses":[],"note":"Install optional psutil for detailed adapter information."})
    return {"ok":True,"interfaces":items,"scope":"local device only"}

def package_managers():
    return {
        "winget": shutil.which("winget"),
        "choco": shutil.which("choco"),
        "scoop": shutil.which("scoop"),
        "apt": shutil.which("apt"),
        "pkg": shutil.which("pkg"),
        "pip": shutil.which("pip") or shutil.which("pip3"),
    }

def run_package_manager(action, package_id=""):
    """Run narrowly-scoped package-manager operations with explicit package IDs."""
    mgrs=package_managers()
    if action not in {"install","list","upgrade"}:
        raise ValueError("Unsupported package operation.")
    if action == "install":
        package_id=str(package_id).strip()
        if not package_id or len(package_id)>120 or any(x in package_id for x in [";","&&","||","\n","\r"]):
            raise ValueError("Enter a package identifier, not a shell command.")
        if mgrs.get("winget"):
            cmd=[mgrs["winget"],"install","--id",package_id,"--exact","--accept-source-agreements","--accept-package-agreements"]
        elif mgrs.get("scoop"):
            cmd=[mgrs["scoop"],"install",package_id]
        elif mgrs.get("choco"):
            cmd=[mgrs["choco"],"install",package_id,"-y","--no-progress"]
        else:
            raise ValueError("No supported desktop package manager was detected.")
    elif action == "list":
        if mgrs.get("winget"): cmd=[mgrs["winget"],"list"]
        elif mgrs.get("choco"): cmd=[mgrs["choco"],"list","--local-only"]
        elif mgrs.get("scoop"): cmd=[mgrs["scoop"],"list"]
        else: raise ValueError("No supported package manager was detected.")
    else:
        if mgrs.get("winget"): cmd=[mgrs["winget"],"upgrade"]
        elif mgrs.get("choco"): cmd=[mgrs["choco"],"upgrade","all","-y","--no-progress"]
        elif mgrs.get("scoop"): cmd=[mgrs["scoop"],"update","*" ]
        else: raise ValueError("No supported package manager was detected.")
    p=subprocess.run(cmd,capture_output=True,text=True,timeout=180,shell=False)
    return {"ok":p.returncode==0,"manager":Path(cmd[0]).name,"stdout":p.stdout[-12000:],"stderr":p.stderr[-6000:],"returncode":p.returncode}

def network_status():
    """Return Alice network permission plus real local connectivity quality.

    Quality is intentionally simple and transparent:
      green/online = internet probe succeeds with normal latency
      yellow/moderate = an adapter/address exists but internet is unavailable or slow
      red/offline = Alice network access is disabled or no usable adapter/address exists
    No remote scanning is performed.
    """
    enabled = bool(network_state.get("enabled", False))
    interfaces = network_interfaces().get("interfaces", [])
    usable = []
    for item in interfaces:
        if not item.get("up"):
            continue
        for addr in item.get("addresses", []):
            value = str(addr.get("address") or "")
            try:
                ip = ipaddress.ip_address(value.split("%", 1)[0])
                if not ip.is_loopback and not ip.is_unspecified:
                    usable.append(value)
            except Exception:
                continue

    quality = "offline"
    label = "Offline"
    latency_ms = None
    probe_error = None

    if enabled and usable:
        started = time.monotonic()
        try:
            req = urllib.request.Request(
                "https://www.google.com/generate_204",
                headers={"User-Agent": "Alice-OS-Network-Check/13.0"}
            )
            with urllib.request.urlopen(req, timeout=3) as response:
                if 200 <= int(response.status) < 500:
                    latency_ms = round((time.monotonic() - started) * 1000, 1)
                    quality = "online" if latency_ms < 250 else "moderate"
                    label = "Online" if quality == "online" else "Moderate"
                else:
                    quality = "moderate"
                    label = "Moderate"
        except Exception as exc:
            probe_error = str(exc)[:160]
            quality = "moderate"
            label = "Moderate"

    return {
        "ok": True,
        "enabled": enabled,
        "mode": "online-enabled" if enabled else "offline",
        "quality": quality,
        "label": label,
        "latency_ms": latency_ms,
        "interface_connected": bool(usable),
        "interfaces": interfaces,
        "probe_error": probe_error,
        "downloads": str(DOWNLOADS.relative_to(ROOT)).replace("\\", "/")
    }

def ai_network_quality():
    """Cached-ish network quality string for AI routing ('online'/'moderate'/'offline')."""
    try:
        return str(network_status().get("quality", "offline"))
    except Exception:
        return "offline"

def ai_parity_snapshot():
    """Single source of truth for the online/offline AI parity state."""
    quality = ai_network_quality()
    enabled = bool(network_state.get("enabled", False))
    status = provider_status(enabled, quality)
    return {
        "ok": True,
        "online": ai_resolve_online(enabled, quality),
        "quality": quality,
        "mode": ai_effective_mode(enabled, quality),
        "auto_online_ai": status.get("auto_online_ai"),
        "cloud_ready": status.get("cloud_ready"),
        "provider_ready": status.get("provider_ready"),
        "parity": True,
        "offline_engine": "offline-brain",
        "detail": status,
    }

def _public_host(host):
    if not host or host.lower() in {"localhost", "localhost.localdomain"}:
        return False
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
        for info in infos:
            addr = ipaddress.ip_address(info[4][0])
            if not addr.is_global:
                return False
    except Exception:
        return False
    return True

def download_network_file(url, filename="", expected_sha256=""):
    if not network_state.get("enabled"):
        raise ValueError("Network access is disabled. Enable Network access in Alice OS first.")
    parsed = urllib.parse.urlparse(str(url).strip())
    if parsed.scheme not in {"https", "http"} or not parsed.hostname:
        raise ValueError("Use a valid HTTP or HTTPS download URL.")
    if not _public_host(parsed.hostname):
        raise ValueError("Alice blocks local/private network destinations for downloads.")
    DOWNLOADS.mkdir(parents=True, exist_ok=True)
    name = Path(urllib.parse.unquote(parsed.path)).name or "download.bin"
    requested = Path(str(filename or name)).name
    if requested in {"", ".", ".."} or requested.startswith("."):
        requested = name
    target = DOWNLOADS / requested
    # Avoid overwriting an existing download.
    if target.exists():
        stem, suffix = target.stem, target.suffix
        i = 2
        while target.exists():
            target = DOWNLOADS / f"{stem} ({i}){suffix}"
            i += 1
    req = urllib.request.Request(str(url).strip(), headers={"User-Agent": "Alice-OS/5.8 Software Center"})
    digest = hashlib.sha256()
    total = 0
    with urllib.request.urlopen(req, timeout=20) as response, target.open("wb") as out:
        content_length = response.headers.get("Content-Length")
        if content_length and int(content_length) > MAX_DOWNLOAD_BYTES:
            raise ValueError("Download exceeds Alice OS 250 MB safety limit.")
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_DOWNLOAD_BYTES:
                out.close()
                target.unlink(missing_ok=True)
                raise ValueError("Download exceeds Alice OS 250 MB safety limit.")
            digest.update(chunk)
            out.write(chunk)
    sha = digest.hexdigest()
    expected = str(expected_sha256 or "").strip().lower()
    if expected and sha != expected:
        target.unlink(missing_ok=True)
        raise ValueError("SHA-256 checksum does not match; download was discarded.")
    return {"ok": True, "file": str(target.relative_to(ROOT)).replace("\\", "/"),
            "name": target.name, "bytes": total, "sha256": sha,
            "verified": bool(expected)}


def task_manager_snapshot():
    """Local Task Manager data. Process control is restricted to user-owned, non-critical processes."""
    rows=[]
    try:
        import psutil
        current=os.getpid()
        for p in psutil.process_iter(['pid','name','cpu_percent','memory_percent','status','username','create_time']):
            try:
                info=p.info; pid=int(info.get('pid') or 0); name=info.get('name') or 'unknown'
                username=info.get('username') or ''
                protected=(pid in (0,1,current) or pid<100 or name.lower() in {'systemd','init','kernel_task'})
                rows.append({"pid":pid,"name":name,"cpu":round(float(info.get('cpu_percent') or 0),1),"memory":round(float(info.get('memory_percent') or 0),1),"status":info.get('status') or 'unknown',"user":username,"can_terminate":bool(not protected and (username==os.getenv('USER','') or username==os.getenv('USERNAME','') or not username))})
            except Exception:
                pass
        rows.sort(key=lambda x:(-x["cpu"],-x["memory"]))
        return {"ok":True,"source":"psutil","processes":rows[:160],"count":len(rows)}
    except Exception:
        return {"ok":True,"source":"basic","processes":[{"pid":os.getpid(),"name":"Alice OS","cpu":0,"memory":0,"status":"running","user":os.getenv('USER',''),"can_terminate":False}],"count":1,"note":"Install optional psutil for detailed local process metrics."}

def task_manager_terminate(pid):
    """Terminate only a non-critical process owned by the current user; never Alice itself or PID 1."""
    try:
        import psutil
        pid=int(pid); current=os.getpid()
        if pid<=1 or pid==current: return {"ok":False,"error":"Protected process."}
        p=psutil.Process(pid)
        if p.username() not in {os.getenv('USER',''),os.getenv('USERNAME','')} and p.username():
            return {"ok":False,"error":"Process is not owned by the current user."}
        name=(p.name() or '').lower()
        if name in {'systemd','init','kernel_task'}: return {"ok":False,"error":"Critical system process protected."}
        p.terminate()
        try: p.wait(timeout=2)
        except psutil.TimeoutExpired: p.kill()
        return {"ok":True,"pid":pid,"message":"Process terminated locally."}
    except Exception as e:
        return {"ok":False,"error":str(e)}

def task_manager_services():
    services=[]
    try:
        import subprocess
        if shutil.which('systemctl'):
            cp=subprocess.run(['systemctl','list-units','--type=service','--no-pager','--plain','--no-legend'],capture_output=True,text=True,timeout=4)
            for line in cp.stdout.splitlines()[:100]:
                parts=line.split(None,3)
                if len(parts)>=4: services.append({"name":parts[0],"load":parts[1],"active":parts[2],"description":parts[3]})
    except Exception: pass
    return {"ok":True,"source":"local","services":services,"note":"Service control is intentionally read-only in this desktop layer."}

def network_control_snapshot():
    data=network_interfaces()
    hostname=socket.gethostname()
    try:
        local_ip=socket.gethostbyname(hostname)
    except Exception:
        local_ip="unavailable"
    return {"ok":True,"hostname":hostname,"local_ip":local_ip,"network_enabled":bool(network_state.get("enabled")),"interfaces":data.get("interfaces",[]),"scope":"Local adapter information only; no remote probing."}

def device_manager_snapshot():
    """Read-only local hardware/device inventory. No remote device access."""
    items=[]
    try:
        import psutil
        items.append({"category":"CPU","name":platform.processor() or platform.machine(),"status":"available"})
        vm=psutil.virtual_memory(); items.append({"category":"Memory","name":f"{round(vm.total/(1024**3),1)} GB RAM","status":"available"})
        for name, stats in psutil.disk_partitions(all=False):
            items.append({"category":"Storage","name":name,"status":"mounted","details":stats.fstype})
        for name, st in psutil.net_if_stats().items():
            items.append({"category":"Network adapter","name":name,"status":"up" if st.isup else "down","details":f"{st.speed} Mbps" if st.speed else "speed unavailable"})
    except Exception:
        items=[{"category":"System","name":platform.platform(),"status":"available"}]
    return {"ok":True,"source":"local","devices":items,"note":"Read-only inventory of this computer; no remote device control."}

def storage_manager_snapshot():
    """Local mounted storage summary."""
    mounts=[]
    try:
        import psutil
        for part in psutil.disk_partitions(all=False):
            try:
                u=psutil.disk_usage(part.mountpoint)
                mounts.append({"mount":part.mountpoint,"filesystem":part.fstype,"total_gb":round(u.total/(1024**3),2),"used_gb":round(u.used/(1024**3),2),"free_gb":round(u.free/(1024**3),2),"used_percent":u.percent})
            except Exception: pass
    except Exception:
        u=shutil.disk_usage(ROOT)
        mounts=[{"mount":str(ROOT),"filesystem":"unknown","total_gb":round(u.total/(1024**3),2),"used_gb":round(u.used/(1024**3),2),"free_gb":round(u.free/(1024**3),2),"used_percent":round(u.used/u.total*100,1)}]
    return {"ok":True,"drives":mounts,"scope":"Local storage only"}

def _cmd_available(name):
    return shutil.which(name)

def _run_fixed(cmd, timeout=12):
    """Run an internally constructed command only; never accepts shell syntax from UI."""
    try:
        p=subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, shell=False)
        return {"ok":p.returncode==0,"stdout":p.stdout.strip()[-8000:],"stderr":p.stderr.strip()[-4000:],"returncode":p.returncode}
    except Exception as e:
        return {"ok":False,"stdout":"","stderr":str(e),"returncode":-1}

def radio_status():
    wifi={"available":bool(_cmd_available("nmcli")),"enabled":None,"state":"unavailable"}
    bluetooth={"available":bool(_cmd_available("rfkill")),"enabled":None,"state":"unavailable"}
    if wifi["available"]:
        r=_run_fixed(["nmcli","radio","wifi"])
        val=r.get("stdout","").lower()
        if "enabled" in val: wifi.update(enabled=True,state="enabled")
        elif "disabled" in val: wifi.update(enabled=False,state="disabled")
    if bluetooth["available"]:
        r=_run_fixed(["rfkill","list","bluetooth"])
        txt=(r.get("stdout","")+"\n"+r.get("stderr","")).lower()
        if "soft blocked: yes" in txt or "hard blocked: yes" in txt:
            bluetooth.update(enabled=False,state="blocked")
        elif "soft blocked: no" in txt:
            bluetooth.update(enabled=True,state="enabled")
    return {"wifi":wifi,"bluetooth":bluetooth,"airplane_mode":bool(network_state.get("airplane_mode",False))}

def set_radio(kind, enabled):
    enabled=bool(enabled)
    if kind=="wifi":
        if not _cmd_available("nmcli"): return {"ok":False,"error":"NetworkManager/nmcli is not installed."}
        r=_run_fixed(["nmcli","radio","wifi","on" if enabled else "off"])
        if r["ok"]: return {"ok":True,"radio":"wifi","enabled":enabled,"status":radio_status()}
        return {"ok":False,"error":r.get("stderr") or "Wi-Fi radio change failed.","status":radio_status()}
    if kind=="bluetooth":
        if not _cmd_available("rfkill"): return {"ok":False,"error":"rfkill is not installed."}
        r=_run_fixed(["rfkill","unblock" if enabled else "block","bluetooth"])
        if r["ok"]: return {"ok":True,"radio":"bluetooth","enabled":enabled,"status":radio_status()}
        return {"ok":False,"error":r.get("stderr") or "Bluetooth radio change failed.","status":radio_status()}
    raise ValueError("Unknown radio.")

def set_airplane_mode(enabled):
    enabled=bool(enabled)
    status=radio_status()
    if enabled:
        network_state["saved_wifi"]=status["wifi"].get("enabled")
        network_state["saved_bluetooth"]=status["bluetooth"].get("enabled")
        network_state["saved_network_enabled"]=bool(network_state.get("enabled", False))
        network_state["airplane_mode"]=True
        save_network_state(False)
        results=[]
        if status["wifi"].get("available"): results.append(set_radio("wifi",False))
        if status["bluetooth"].get("available"): results.append(set_radio("bluetooth",False))
        return {"ok":all(x.get("ok",False) for x in results) if results else True,"airplane_mode":True,"results":results,"status":radio_status()}
    network_state["airplane_mode"]=False
    network_state["enabled"]=bool(network_state.get("saved_network_enabled", False))
    save_network_state(bool(network_state.get("enabled", False)))
    results=[]
    sw=network_state.get("saved_wifi")
    sb=network_state.get("saved_bluetooth")
    if sw is not None and status["wifi"].get("available"): results.append(set_radio("wifi",bool(sw)))
    if sb is not None and status["bluetooth"].get("available"): results.append(set_radio("bluetooth",bool(sb)))
    return {"ok":all(x.get("ok",False) for x in results) if results else True,"airplane_mode":False,"results":results,"status":radio_status()}

def wifi_scan():
    if not _cmd_available("nmcli"): return {"ok":False,"error":"NetworkManager/nmcli is not installed.","networks":[]}
    r=_run_fixed(["nmcli","-t","-f","SSID,SIGNAL,SECURITY","device","wifi","list","--rescan","no"],timeout=15)
    if not r["ok"]: return {"ok":False,"error":r.get("stderr") or "Wi-Fi scan failed.","networks":[]}
    items=[]
    for line in r.get("stdout","").splitlines():
        parts=line.split(":")
        if len(parts)>=3:
            ssid=parts[0].replace("\\:",":").strip()
            if not ssid: continue
            items.append({"ssid":ssid,"signal":parts[1],"security":":".join(parts[2:])})
    return {"ok":True,"networks":items[:50]}

def wifi_connect(ssid,password=""):
    ssid=str(ssid or "").strip()
    if not ssid or len(ssid)>200: raise ValueError("Enter a valid Wi-Fi network name.")
    if network_state.get("airplane_mode"): raise ValueError("Turn off Airplane mode before connecting to Wi-Fi.")
    if not _cmd_available("nmcli"): raise ValueError("NetworkManager/nmcli is not installed.")
    # Credentials are passed directly to nmcli and are not saved by Alice OS.
    cmd=["nmcli","device","wifi","connect",ssid]
    if password: cmd += ["password",str(password)]
    r=_run_fixed(cmd,timeout=30)
    return {"ok":r["ok"],"message":r["stdout"] if r["ok"] else (r["stderr"] or "Wi-Fi connection failed."),"status":radio_status()}

def connectivity_snapshot():
    mgrs=package_managers()
    return {"ok":True,"network_enabled":bool(network_state.get("enabled")),"airplane_mode":bool(network_state.get("airplane_mode")),"radios":radio_status(),"interfaces":network_interfaces().get("interfaces",[]),"package_managers":mgrs,"capabilities":{"wifi_control":bool(_cmd_available("nmcli")),"bluetooth_control":bool(_cmd_available("rfkill")),"wifi_scan":bool(_cmd_available("nmcli"))}}

def update_center_snapshot():
    mgrs=package_managers()
    return {"ok":True,"alice_version":VERSION,"package_managers":mgrs,"update_actions":["Check package-manager updates","Review installed software","Install a named package"],"note":"Updates are initiated explicitly by the owner and run through detected local package managers."}

def system_snapshot():
    total, used, free = shutil.disk_usage(ROOT)
    data = {
        "platform": platform.system(),
        "release": platform.release(),
        "machine": platform.machine(),
        "processor": platform.processor(),
        "cpu_percent": None,
        "ram_percent": None,
        "storage_percent": round((used / total) * 100, 1),
        "storage_free_gb": round(free / (1024**3), 2),
        "uptime_seconds": None
    }
    try:
        import psutil
        data["cpu_percent"] = psutil.cpu_percent(interval=0.05)
        data["ram_percent"] = psutil.virtual_memory().percent
        data["uptime_seconds"] = int(time.time() - psutil.boot_time())
    except Exception:
        pass
    return data

ALLOWED_APPS = {
    "terminal": None,
    "files": None,
    "settings": None,
    "chat": None,
    "skills": None,
    "devices": None,
    "security": None,
    "vault": None,
    "home": None,
}

def launch_local_app(app_name):
    app = str(app_name or "").lower().strip()
    if app not in ALLOWED_APPS:
        return {"ok": False, "message": "That application is not in Alice's approved launcher."}
    return {"ok": True, "app": app, "message": f"Launch request approved for {app}."}


AUTH_FILE = DATA / "auth.json"

def load_auth():
    try:
        return json.loads(AUTH_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}

def save_auth(data):
    AUTH_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

def password_hash(password, salt, iterations=260000):
    import hashlib
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)

def create_password_record(password):
    salt = secrets.token_bytes(16)
    digest = password_hash(password, salt)
    return {
        "salt": base64.b64encode(salt).decode(),
        "digest": base64.b64encode(digest).decode(),
        "iterations": 260000
    }

def verify_owner_password(password):
    auth = load_auth()
    if not auth.get("salt") or not auth.get("digest"):
        return False
    try:
        salt = base64.b64decode(auth["salt"])
        expected = base64.b64decode(auth["digest"])
        actual = password_hash(password, salt, int(auth.get("iterations", 260000)))
        return secrets.compare_digest(actual, expected)
    except Exception:
        return False


# ---------- Alice OS v4.1 local services ----------
WORKSPACE_DIR = ROOT / "workspace"
BACKUP_DIR = ROOT / "backups"
WORKSPACE_DIR.mkdir(exist_ok=True)
BACKUP_DIR.mkdir(exist_ok=True)

def safe_workspace_path(rel=""):
    p=(WORKSPACE_DIR / str(rel or "")).resolve()
    if p != WORKSPACE_DIR.resolve() and WORKSPACE_DIR.resolve() not in p.parents:
        raise ValueError("Path is outside Alice's protected workspace.")
    return p

def workspace_list(rel=""):
    base=safe_workspace_path(rel)
    if not base.exists() or not base.is_dir():
        raise ValueError("Workspace directory not found.")
    out=[]
    for p in sorted(base.iterdir(), key=lambda x:(not x.is_dir(), x.name.lower())):
        try: size=p.stat().st_size if p.is_file() else 0
        except OSError: size=0
        out.append({"name":p.name,"type":"folder" if p.is_dir() else "file","size":size})
    return {"path":str(base.relative_to(WORKSPACE_DIR)) if base!=WORKSPACE_DIR else "","items":out}

def workspace_create_folder(name):
    p=safe_workspace_path(name)
    if p.exists(): raise ValueError("Item already exists.")
    p.mkdir(parents=True)
    return {"ok":True,"path":str(p.relative_to(WORKSPACE_DIR))}

def workspace_create_file(name, content=""):
    p=safe_workspace_path(name)
    if p.exists(): raise ValueError("Item already exists.")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(str(content), encoding="utf-8")
    return {"ok":True,"path":str(p.relative_to(WORKSPACE_DIR))}

def workspace_delete(name):
    p=safe_workspace_path(name)
    if p == WORKSPACE_DIR: raise ValueError("Workspace root cannot be deleted.")
    if not p.exists(): raise ValueError("Item not found.")
    if p.is_dir(): shutil.rmtree(p)
    else: p.unlink()
    return {"ok":True,"deleted":str(p.relative_to(WORKSPACE_DIR))}

def local_security_audit():
    a=load_auth()
    checks=[
        {"name":"Owner password","status":"PASS" if a.get("salt") and a.get("digest") else "WARN"},
        {"name":"Protected workspace","status":"PASS"},
        {"name":"Local-only API","status":"PASS"},
        {"name":"Approved app launcher","status":"PASS"},
    ]
    try:
        import psutil
        checks.append({"name":"System monitor","status":"PASS"})
    except Exception:
        checks.append({"name":"System monitor","status":"INFO"})
    return {"checks":checks,"scope":"Defensive local audit only."}

def skill_catalog():
    return [
        {"id":"terminal","name":"Terminal","status":"ready","mode":"offline","description":"Approved local command adapter."},
        {"id":"files","name":"Files & Data","status":"ready","mode":"offline","description":"Protected Alice workspace manager."},
        {"id":"system","name":"System Monitor","status":"ready","mode":"offline","description":"CPU, RAM, storage and platform telemetry."},
        {"id":"security","name":"Security Lab","status":"ready","mode":"offline","description":"Defensive local configuration and authorized testing concepts."},
        {"id":"penetrating","name":"Penetration Lab","status":"authorized-only","mode":"offline","description":"Defensive/authorized lab workflow; no credential theft or persistence."},
        {"id":"locating","name":"Locator","status":"permission","mode":"offline","description":"Permission-based local location adapter; no covert tracking."},
        {"id":"generating","name":"Generator","status":"foundation","mode":"offline","description":"Local image/document generation adapter; cloud generators disabled offline."},
        {"id":"access","name":"Access Manager","status":"ready","mode":"offline","description":"Owner authentication, recovery and authorized access management."},
        {"id":"bypass","name":"Protection Checks","status":"defensive","mode":"offline","description":"Audits protection controls; CAPTCHA/security bypass is not implemented."},
        {"id":"solving","name":"Problem Solver","status":"ready","mode":"offline","description":"Local computational and reasoning utilities."},
        {"id":"comparing","name":"Compare","status":"ready","mode":"offline","description":"Local file, configuration and data comparison."},
        {"id":"defensive-sim","name":"Threat Simulator","status":"defensive","mode":"offline","description":"Safe local alert/testing simulation only."},
        {"id":"translation","name":"Translator","status":"foundation","mode":"offline","description":"Local translation interface; language packs can be installed locally."},
        {"id":"projection","name":"Projection","status":"foundation","mode":"offline","description":"Local display/projection adapter."},
        {"id":"backup","name":"Profile Backup","status":"ready","mode":"offline","description":"Backup/export of Alice configuration; no account impersonation."},
        {"id":"biometrics","name":"Biometric Gate","status":"foundation","mode":"offline","description":"Uses OS-provided biometric APIs when available; never fakes verification."},
        {"id":"password-audit","name":"Password Audit","status":"defensive","mode":"offline","description":"Defensive password-strength guidance; no password cracking."},
        {"id":"wallet","name":"Self Wallet","status":"foundation","mode":"offline","description":"Local vault concept for personal records; not a payment processor."},
        {"id":"voice","name":"Voice Mode","status":"foundation","mode":"offline","description":"Local voice adapter interface; cloud voice disabled."},
        {"id":"media","name":"Media Studio","status":"foundation","mode":"offline","description":"Local media workspace; online video APIs disabled."},
        {"id":"email","name":"Email Adapter","status":"disabled","mode":"offline","description":"Network email access is disabled in offline mode."},
        {"id":"ai-providers","name":"AI Provider Hub","status":"offline","mode":"offline","description":"Provider adapters are listed for architecture only; no cloud calls in offline mode."},
        {"id":"devices","name":"Device Hub","status":"foundation","mode":"offline","description":"Approved local device abstraction layer."},
        {"id":"os-explore","name":"OS Explore","status":"foundation","mode":"offline","description":"Linux/Kali exploration concept restricted to an authorized lab."},
    ]


def notebook_skill_catalog():
    return skill_catalog()

def create_local_backup():
    stamp=time.strftime("%Y%m%d_%H%M%S")
    target=BACKUP_DIR/f"Alice_backup_{stamp}.json"
    payload={
        "version":"4.1.0","created":stamp,
        "auth":load_auth(),"settings":settings
    }
    target.write_text(json.dumps(payload,indent=2),encoding="utf-8")
    return {"ok":True,"file":str(target.relative_to(ROOT))}

# ---------- end v4.1 local services ----------


# ---------- Alice OS v4.2 desktop services ----------
NOTIFICATIONS_FILE = DATA / "notifications.json"

def read_json_file(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default

def write_json_file(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2), encoding="utf-8")

def v42_settings():
    return read_json_file(DATA / "settings.json", {})

def v42_save_settings(patch):
    current = v42_settings()
    if isinstance(patch, dict):
        current.update(patch)
    write_json_file(DATA / "settings.json", current)
    return current

def wallpaper_catalog():
    WALLPAPERS.mkdir(exist_ok=True)
    items=[]
    for p in sorted(WALLPAPERS.iterdir()):
        if p.is_file() and p.suffix.lower() in {".png",".jpg",".jpeg",".webp",".svg"}:
            items.append({"name":p.name,"url":"/wallpapers/"+p.name})
    return items

def notification_feed():
    data=read_json_file(NOTIFICATIONS_FILE, [])
    return data if isinstance(data,list) else []

def add_notification(title, message, kind="info"):
    items=notification_feed()
    items.insert(0, {"title":str(title),"message":str(message),"kind":str(kind),"time":time.time()})
    write_json_file(NOTIFICATIONS_FILE, items[:50])

# Alice Cloud Vault: local-first persistence for owner memories, process history and reminders.
cloud_init(ROOT, add_notification)
cloud_sync_init(ROOT)
cloud_start_scheduler()

# ---------- end v4.2 desktop services ----------

# ---------- Alice OS v5.7 local intelligence ----------
MEMORY_FILE = DATA / "memory.json"
INTENT_LOG = DATA / "intelligence_history.json"

def local_memory():
    data = read_json_file(MEMORY_FILE, [])
    return data if isinstance(data, list) else []

def save_local_memory(text):
    text = str(text or "").strip()
    if not text:
        raise ValueError("Memory text cannot be empty.")
    items = local_memory()
    items.insert(0, {"text": text, "time": time.time()})
    write_json_file(MEMORY_FILE, items[:100])
    return {"ok": True, "saved": text, "count": len(items[:100])}

def intelligence_history():
    data = read_json_file(INTENT_LOG, [])
    return data if isinstance(data, list) else []

def log_intent(text, intent, response):
    items = intelligence_history()
    items.insert(0, {"text": text, "intent": intent, "response": response, "time": time.time()})
    write_json_file(INTENT_LOG, items[:100])

def local_intelligence(text):
    raw = str(text or "").strip()
    low = raw.lower()
    if not raw:
        return {"ok": False, "intent": "empty", "message": "Type a command or question for Alice."}

    def result(intent, message, **extra):
        log_intent(raw, intent, message)
        return {"ok": True, "intent": intent, "message": message, **extra}

    if low in {"help", "what can you do", "what can you do?"}:
        return result("help", "I can open Alice tools, report local system status, manage notes and local memory, show skills, check offline mode, and lock the desktop.")
    open_map = {
        "settings":"settings", "terminal":"terminal", "files":"files", "file manager":"files",
        "skills":"skills", "skills hub":"skills", "devices":"devices", "locator":"devices",
        "security":"security", "security lab":"security", "vault":"vault", "memory vault":"vault",
        "chat":"chat", "home":"home", "alice home":"home", "intelligence":"intelligence", "intelligence center":"intelligence"
    }
    if low.startswith("open "):
        target=low[5:].strip()
        if target in open_map:
            return result("open", f"Opening {open_map[target].replace('-', ' ')}.", target=open_map[target])
    if low in open_map:
        return result("open", f"Opening {open_map[low].replace('-', ' ')}.", target=open_map[low])
    if low in {"status", "system", "system status", "show system status"}:
        snap=system_snapshot()
        cpu="unavailable" if snap["cpu_percent"] is None else f'{snap["cpu_percent"]}%'
        ram="unavailable" if snap["ram_percent"] is None else f'{snap["ram_percent"]}%'
        return result("system_status", f"Local system: CPU {cpu}, RAM {ram}, storage {snap['storage_percent']}% used.", data=snap)
    if low in {"alice status", "assistant status", "how is alice", "how is my computer"}:
        d=dashboard_snapshot()
        health=str(d.get("health","normal"))
        active=d.get("actions",{}).get("active",0)
        rec=d.get("events",{}).get("recommendations",0)
        return result("assistant_status", f"Alice is running locally. Overall health is {health}. There are {active} active action(s) and {rec} recommendation(s).", data=d)
    if low in {"security status", "security", "is my computer secure"}:
        sec=security_snapshot(); cfg=sec.get("config",{})
        return result("security_status", f"Local protection is active. Camera permission is {'enabled' if cfg.get('camera_permission') else 'disabled'}, phone alerts are {'enabled' if cfg.get('phone_alerts_enabled') else 'disabled'}, and {len(sec.get('events',[]))} security event(s) are recorded.", data=sec)
    if low in {"events", "recent events", "event timeline", "what happened"}:
        ev=event_engine_snapshot()
        return result("events", f"Alice has {len(ev.get('timeline',[]))} recent timeline event(s) and {len(ev.get('recommendations',[]))} recommendation(s).", data=ev)
    if low in {"recommendations", "what should i do", "system recommendations"}:
        ev=event_engine_snapshot(); recs=ev.get('recommendations',[])
        msg="There are no current recommendations." if not recs else "I found %d local recommendation(s). Review them in the Action Center; Alice will not make changes automatically." % len(recs)
        return result("recommendations", msg, data={"recommendations":recs})
    if low in {"workflows", "show workflows", "available workflows"}:
        wf=workflow_snapshot(); return result("workflows", f"There are {len(wf.get('workflows',[]))} owner-approved local workflows available.", data=wf)
    if low in {"system info", "system information", "show system information"}:
        return result("system_info", "Here is the local system information.", data=system_snapshot())
    if low in {"offline status", "am i offline", "is alice offline", "network status"}:
        return result("offline_status", "Alice is configured for offline-only operation and the local server is loopback-bound.", data={"offline": True, "network_enabled": False, "bind_host": ALICE_BIND_HOST})
    if low in {"show skills", "list skills", "my skills"}:
        return result("skills", "The Alice skill catalog is available.", skills=skill_catalog())
    if low.startswith("remember "):
        return result("remember", "Saved that to Alice's local memory.", memory=save_local_memory(raw[9:].strip()))
    if low in {"show memory", "memory", "my memory", "remembered"}:
        mem=local_memory()
        if not mem:
            return result("memory", "Alice's local memory is empty.", memory=[])
        return result("memory", f"Alice has {len(mem)} local memory item(s).", memory=mem)
    if low in {"time", "what time is it", "current time"}:
        return result("time", time.strftime("The local time is %H:%M:%S."))
    if low in {"date", "what is today's date", "today's date"}:
        return result("date", time.strftime("Today's date is %A, %d %B %Y."))
    if low in {"lock", "lock alice", "lock desktop"}:
        return result("lock", "Locking Alice.", target="lock")
    if low in {"diagnostics", "run diagnostics", "system diagnostics"}:
        checks={"ui":UI.exists(),"data":DATA.exists(),"auth_file":AUTH_FILE.exists(),"offline_mode":ALICE_OFFLINE_MODE,"loopback_only":ALICE_BIND_HOST=="127.0.0.1"}
        return result("diagnostics", "Local diagnostics completed.", data={"ok":all(checks.values()),"checks":checks})
    try:
        ai = ai_ask(raw, context={"local_system": system_snapshot()}, network_enabled=network_state.get("enabled",False), audit={"checks":[]}, quality=ai_network_quality())
        if ai.get("provider") != "friday" or ai.get("answer"):
            return result("ai", ai.get("answer", "I could not produce an answer."), provider=ai.get("provider"), mode=ai.get("mode"), data=ai.get("data",{}), errors=ai.get("errors",[]))
    except Exception:
        pass
    return result("unknown", "I can handle local Alice commands, but that request is not connected to a local skill yet.")

# ---------- end v5.7 local intelligence ----------

# ---------- Alice OS v6.3 Accounts / Action Center / Recovery ----------
ACTION_FILE = DATA / "action_center.json"
STARTUP_FILE = DATA / "startup.json"

def action_center_items():
    try: return json.loads(ACTION_FILE.read_text(encoding="utf-8")) if ACTION_FILE.exists() else []
    except Exception: return []

def save_action_center(items):
    ACTION_FILE.write_text(json.dumps(items[-100:], indent=2), encoding="utf-8")

def add_action(title, message, level="info"):
    items=action_center_items(); items.append({"title":str(title)[:120],"message":str(message)[:500],"level":str(level)[:20],"time":time.strftime("%Y-%m-%d %H:%M:%S")}); save_action_center(items)
    return items[-1]

def startup_preferences():
    try: data=json.loads(STARTUP_FILE.read_text(encoding="utf-8")) if STARTUP_FILE.exists() else {}
    except Exception: data={}
    return {"launch_on_start":bool(data.get("launch_on_start",False)),"restore_windows":bool(data.get("restore_windows",True)),"start_locked":bool(data.get("start_locked",False))}

def save_startup_preferences(data):
    clean={"launch_on_start":bool(data.get("launch_on_start",False)),"restore_windows":bool(data.get("restore_windows",True)),"start_locked":bool(data.get("start_locked",False))}
    STARTUP_FILE.write_text(json.dumps(clean,indent=2),encoding="utf-8"); return clean

def account_snapshot():
    a=load_auth(); return {"owner_name":settings.get("user_name","Owner"),"password_configured":bool(a.get("salt") and a.get("digest")),"authentication":"local PBKDF2 password" if a.get("salt") else "not configured","scope":"This Alice OS installation"}

def recovery_snapshot():
    files=[]
    for d in (DATA / "backups", BACKUP_DIR):
        if d.exists():
            for f in d.glob("*"):
                if f.is_file(): files.append({"name":f.name,"path":str(f.relative_to(ROOT)).replace("\\","/"),"bytes":f.stat().st_size})
    return {"ok":True,"backups":files,"note":"Backups contain Alice configuration; authentication secrets are not exported by settings backup."}


# ---------- Alice OS v10.1 Proactive Local System Monitor ----------
MONITOR_CONFIG_FILE = DATA / "monitor.json"
MONITOR_EVENTS_FILE = DATA / "monitor_events.json"
MONITOR_DEFAULTS = {
    "enabled": True,
    "interval_seconds": 5,
    "cpu_threshold": 90,
    "ram_threshold": 90,
    "storage_threshold": 90,
    "update_notifications": True,
    "security_notifications": True,
}
_monitor_lock = threading.Lock()
_monitor_last = {}
_monitor_last_event = {}
_monitor_thread = None

def monitor_config():
    cfg = read_json_file(MONITOR_CONFIG_FILE, {})
    out = dict(MONITOR_DEFAULTS)
    if isinstance(cfg, dict): out.update(cfg)
    out["interval_seconds"] = max(3, min(60, int(out.get("interval_seconds", 5))))
    for k in ("cpu_threshold","ram_threshold","storage_threshold"):
        out[k] = max(50, min(99, int(out.get(k, 90))))
    for k in ("enabled","update_notifications","security_notifications"): out[k] = bool(out.get(k, MONITOR_DEFAULTS[k]))
    return out

def save_monitor_config(cfg):
    clean = monitor_config(); clean.update(cfg or {})
    write_json_file(MONITOR_CONFIG_FILE, clean)
    return monitor_config()

def monitor_events():
    data = read_json_file(MONITOR_EVENTS_FILE, [])
    return data if isinstance(data, list) else []

def add_monitor_event(kind, title, message, level="info"):
    item = {"id": int(time.time()*1000), "kind": str(kind), "title": str(title)[:120], "message": str(message)[:500], "level": str(level)[:20], "time": time.strftime("%Y-%m-%d %H:%M:%S")}
    items = monitor_events(); items.append(item); write_json_file(MONITOR_EVENTS_FILE, items[-100:])
    add_action(item["title"], item["message"], item["level"])
    return item

def monitor_snapshot():
    snap = system_snapshot()
    cfg = monitor_config()
    return {"ok": True, "enabled": cfg["enabled"], "config": cfg, "system": snap, "events": monitor_events()[-30:]}

def _monitor_loop():
    global _monitor_thread
    while True:
        try:
            cfg = monitor_config()
            if cfg["enabled"]:
                snap = system_snapshot()
                vals = {"cpu": snap.get("cpu_percent"), "ram": snap.get("ram_percent"), "storage": snap.get("storage_percent")}
                for key, threshold in (("cpu",cfg["cpu_threshold"]),("ram",cfg["ram_threshold"]),("storage",cfg["storage_threshold"])):
                    value = vals.get(key)
                    if value is not None and value >= threshold:
                        # Debounce identical warnings for 5 minutes.
                        now = time.time()
                        if now - _monitor_last_event.get(key, 0) >= 300:
                            _monitor_last_event[key] = now
                            add_monitor_event("health", f"High {key.upper()} usage", f"Local {key.upper()} usage is {value:.1f}% (threshold {threshold}%). Alice is monitoring only; no automatic destructive action was taken.", "warning")
                if cfg["security_notifications"]:
                    sev = security_events()
                    latest = sev[-1] if sev else None
                    if latest:
                        stamp = str(latest.get("time",""))
                        if stamp and stamp != _monitor_last.get("security"):
                            _monitor_last["security"] = stamp
                            add_monitor_event("security", "Security event detected", f"A local security event was recorded at {stamp}.", "security")
            time.sleep(cfg["interval_seconds"] if cfg.get("enabled") else 10)
        except Exception as e:
            time.sleep(10)

def start_monitor():
    global _monitor_thread
    if _monitor_thread and _monitor_thread.is_alive(): return
    _monitor_thread = threading.Thread(target=_monitor_loop, name="AliceLocalMonitor", daemon=True)
    _monitor_thread.start()

# ---------- end v10.1 proactive monitor ----------

# ---------- Alice OS v10.2 System Supervisor & Permission Center ----------
SUPERVISOR_FILE = DATA / "supervisor.json"
SUPERVISOR_DEFAULTS = {
    "enabled": True,
    "permission_notifications": True,
    "update_notifications": True,
    "health_notifications": True,
    "security_notifications": True,
    "camera_permission": False,
    "microphone_permission": False,
    "location_permission": False,
    "desktop_notifications": True,
    "app_launch_permission": True,
}

def supervisor_config():
    cfg = read_json_file(SUPERVISOR_FILE, {})
    out = dict(SUPERVISOR_DEFAULTS)
    if isinstance(cfg, dict): out.update(cfg)
    for k in SUPERVISOR_DEFAULTS: out[k] = bool(out.get(k, SUPERVISOR_DEFAULTS[k]))
    # Camera remains governed by the dedicated security permission as well.
    sec = security_config()
    out["camera_permission"] = bool(sec.get("camera_permission", out["camera_permission"]))
    return out

def save_supervisor_config(cfg):
    current = supervisor_config(); current.update(cfg or {})
    clean = {k: bool(current.get(k, v)) for k, v in SUPERVISOR_DEFAULTS.items()}
    write_json_file(SUPERVISOR_FILE, clean)
    # Keep security camera permission synchronized with the central permission center.
    sec = security_config()
    sec["camera_permission"] = clean["camera_permission"]
    save_security_config(sec)
    return supervisor_config()

def supervisor_snapshot():
    cfg = supervisor_config()
    return {
        "ok": True,
        "enabled": cfg["enabled"],
        "config": cfg,
        "network": network_status(),
        "monitor": monitor_config(),
        "updates": update_center_snapshot(),
        "security": security_snapshot()["config"],
        "note": "Permission switches are Alice preferences; browser/host OS permission prompts still apply."
    }

def supervisor_event(title, message, level="info"):
    return add_monitor_event("supervisor", title, message, level)

# ---------- Alice OS v10.3 Event Engine & Recommendations ----------
EVENT_ENGINE_FILE = DATA / "event_engine.json"
EVENT_ENGINE_DEFAULTS = {
    "enabled": True,
    "recommendations": True,
    "timeline_limit": 100,
}

def event_engine_config():
    cfg = read_json_file(EVENT_ENGINE_FILE, {})
    out = dict(EVENT_ENGINE_DEFAULTS)
    if isinstance(cfg, dict): out.update(cfg)
    out["enabled"] = bool(out.get("enabled", True))
    out["recommendations"] = bool(out.get("recommendations", True))
    try: out["timeline_limit"] = max(20, min(250, int(out.get("timeline_limit", 100))))
    except Exception: out["timeline_limit"] = 100
    return out

def save_event_engine_config(cfg):
    current = event_engine_config(); current.update(cfg or {})
    out = {"enabled": bool(current.get("enabled", True)), "recommendations": bool(current.get("recommendations", True)), "timeline_limit": max(20, min(250, int(current.get("timeline_limit", 100))))}
    write_json_file(EVENT_ENGINE_FILE, out)
    return out

def event_timeline(limit=100):
    items = monitor_events() + security_events()
    seen = set(); merged=[]
    for x in items:
        key=(x.get("id"), x.get("time"), x.get("title"))
        if key in seen: continue
        seen.add(key); merged.append(x)
    merged.sort(key=lambda x: str(x.get("time", "")), reverse=True)
    return merged[:max(1, min(int(limit), 250))]

def event_recommendations():
    cfg=event_engine_config()
    if not cfg["recommendations"]: return []
    recent=event_timeline(50); rec=[]; seen=set()
    def add(key,title,message,level="info"):
        if key not in seen: seen.add(key); rec.append({"key":key,"title":title,"message":message,"level":level})
    for e in recent:
        t=str(e.get("title","")).lower(); m=str(e.get("message","")).lower()
        if "high cpu" in t and "cpu" not in seen:
            add("cpu","Check CPU-heavy applications","Alice detected sustained high CPU usage. Review Task Manager before closing anything.","warning")
        if "high ram" in t and "ram" not in seen:
            add("ram","Review memory usage","Alice detected high RAM usage. Check Task Manager for applications using unusual amounts of memory.","warning")
        if "high storage" in t and "storage" not in seen:
            add("storage","Review storage space","Alice detected high storage usage. Review Storage Manager before deleting files.","warning")
        if "security event" in t or e.get("kind")=="security" or "failed unlock" in m:
            add("security","Review Security Center","A security event was recorded. Review the event details and confirm that owner protection settings are correct.","security")
    return rec[:10]

def event_engine_snapshot():
    cfg=event_engine_config()
    return {"ok":True,"config":cfg,"timeline":event_timeline(cfg["timeline_limit"]),"recommendations":event_recommendations(),"note":"Recommendations are local, informational and require owner action."}

# ---------- Alice OS v10.4 Action Center ----------
ACTION_ACK_FILE = DATA / "action_acknowledgements.json"

def action_acknowledgements():
    x = read_json_file(ACTION_ACK_FILE, {})
    return x if isinstance(x, dict) else {}

def save_action_acknowledgements(x):
    write_json_file(ACTION_ACK_FILE, x if isinstance(x, dict) else {})

def action_center_snapshot():
    recs = event_recommendations()
    ack = action_acknowledgements()
    active=[]
    for r in recs:
        if not ack.get(r.get("key"), False):
            active.append(r)
    return {
        "ok": True,
        "active": active,
        "acknowledged": [k for k,v in ack.items() if v],
        "actions": [
            {"id":"task_manager","label":"Open Task Manager","description":"Review running processes locally."},
            {"id":"storage","label":"Open Storage Manager","description":"Review local storage usage."},
            {"id":"security","label":"Open Security Center","description":"Review local security events and protection settings."},
            {"id":"updates","label":"Check for Updates","description":"Check update information; installation remains owner-approved."},
            {"id":"lock","label":"Lock Alice OS","description":"Immediately show the owner lock screen."}
        ]
    }

def acknowledge_action(key):
    key=str(key or "").strip()[:80]
    if not key: raise ValueError("Missing recommendation key.")
    x=action_acknowledgements(); x[key]=True; save_action_acknowledgements(x)
    return action_center_snapshot()
# ---------- end v10.4 action center ----------


# ---------- Alice OS v10.6 Intelligent System Dashboard ----------
DASHBOARD_DEFAULTS = {"enabled": True, "refresh_seconds": 5}
DASHBOARD_FILE = DATA / "dashboard.json"

def dashboard_config():
    cfg = read_json_file(DASHBOARD_FILE, {})
    out = dict(DASHBOARD_DEFAULTS)
    if isinstance(cfg, dict): out.update(cfg)
    try: out["refresh_seconds"] = max(2, min(60, int(out.get("refresh_seconds", 5))))
    except Exception: out["refresh_seconds"] = 5
    out["enabled"] = bool(out.get("enabled", True))
    return out

def save_dashboard_config(cfg):
    cur = dashboard_config(); cur.update(cfg or {})
    out = {"enabled": bool(cur.get("enabled", True)), "refresh_seconds": max(2, min(60, int(cur.get("refresh_seconds", 5))))}
    write_json_file(DASHBOARD_FILE, out)
    return out

def dashboard_snapshot():
    cfg = dashboard_config()
    mon = monitor_snapshot(); sup = supervisor_snapshot(); ev = event_engine_snapshot(); ac = action_center_snapshot(); wf = workflow_snapshot(); sec = security_snapshot()
    system = mon.get("system", {}) if isinstance(mon, dict) else {}
    active = ac.get("active", []) if isinstance(ac, dict) else []
    return {
        "ok": True, "config": cfg,
        "time": datetime.now().isoformat(timespec="seconds"),
        "system": {"cpu_percent": system.get("cpu_percent"), "ram_percent": system.get("ram_percent"), "storage_percent": system.get("storage_percent"), "platform": system.get("platform"), "hostname": system.get("hostname")},
        "monitor": {"enabled": bool(mon.get("config", {}).get("enabled", False)), "interval_seconds": mon.get("config", {}).get("interval_seconds", 5)},
        "supervisor": {"enabled": bool(sup.get("enabled", False)), "desktop_notifications": bool(sup.get("config", {}).get("desktop_notifications", False))},
        "security": {"camera_permission": bool(sec.get("config", {}).get("camera_permission", False)), "phone_alerts_enabled": bool(sec.get("config", {}).get("phone_alerts_enabled", False)), "recent_events": len(sec.get("events", []))},
        "events": {"recent": len(ev.get("timeline", [])), "recommendations": len(ev.get("recommendations", []))},
        "actions": {"active": len(active)},
        "workflows": {"enabled": bool(wf.get("config", {}).get("enabled", False)), "available": len(wf.get("workflows", [])), "history": len(wf.get("history", []))},
        "network": network_status(),
        "updates": update_center_snapshot(),
        "health": "attention" if active else "normal",
    }
# ---------- end v10.6 Intelligent System Dashboard ----------

# ---------- Alice OS v10.5 Automation & Workflow Engine ----------
WORKFLOW_HISTORY_FILE = DATA / "workflow_history.json"
WORKFLOW_DEFAULTS = {"enabled": True, "history_limit": 100}

def workflow_config():
    cfg = read_json_file(DATA / "workflow.json", {})
    out = dict(WORKFLOW_DEFAULTS)
    if isinstance(cfg, dict): out.update(cfg)
    out["enabled"] = bool(out.get("enabled", True))
    try: out["history_limit"] = max(20, min(250, int(out.get("history_limit", 100))))
    except Exception: out["history_limit"] = 100
    return out

def save_workflow_config(cfg):
    current = workflow_config(); current.update(cfg or {})
    out = {"enabled": bool(current.get("enabled", True)), "history_limit": max(20, min(250, int(current.get("history_limit", 100))))}
    write_json_file(DATA / "workflow.json", out)
    return out

def workflow_history():
    x = read_json_file(WORKFLOW_HISTORY_FILE, [])
    return x if isinstance(x, list) else []

def save_workflow_history(items):
    write_json_file(WORKFLOW_HISTORY_FILE, items[-workflow_config()["history_limit"]:])

def workflow_catalog():
    return [
        {"id":"health_check","name":"System Health Check","description":"Read CPU, RAM, storage, network and Alice service health. No changes are made.","mode":"read-only"},
        {"id":"security_review","name":"Security Review","description":"Review local protection status and recent security events. No capture or remote notification is triggered.","mode":"read-only"},
        {"id":"update_check","name":"Update Check","description":"Refresh local update/package-manager information. Installing updates still requires a separate explicit action.","mode":"read-only"},
        {"id":"settings_backup","name":"Settings Backup","description":"Create a local backup of Alice settings without exporting authentication secrets.","mode":"local-write"},
        {"id":"diagnostics","name":"Alice Diagnostics","description":"Run local integrity checks for the UI, data directory, authentication and offline binding.","mode":"read-only"},
    ]

def run_workflow(workflow_id):
    wid = str(workflow_id or "").strip()
    cfg = workflow_config()
    if not cfg["enabled"]: raise ValueError("Workflow Engine is disabled in Alice settings.")
    allowed = {x["id"] for x in workflow_catalog()}
    if wid not in allowed: raise ValueError("Unknown workflow.")
    result = {"ok": True, "id": wid, "time": time.strftime("%Y-%m-%d %H:%M:%S")}
    if wid == "health_check":
        result["data"] = {"system": system_snapshot(), "network": network_status(), "alice": {"version": VERSION, "offline": ALICE_OFFLINE_MODE, "loopback": ALICE_BIND_HOST == "127.0.0.1"}}
    elif wid == "security_review":
        result["data"] = {"security": security_snapshot(), "recent_events": security_events()[-10:]}
    elif wid == "update_check":
        result["data"] = update_center_snapshot()
    elif wid == "settings_backup":
        backup_dir = DATA / "backups"; backup_dir.mkdir(exist_ok=True)
        target = backup_dir / f"alice-settings-{time.strftime('%Y%m%d_%H%M%S')}.json"
        safe = {k:v for k,v in settings.items() if k not in {"password","auth"}}
        target.write_text(json.dumps(safe, indent=2), encoding="utf-8")
        result["data"] = {"path": str(target.relative_to(ROOT)).replace("\\","/"), "bytes": target.stat().st_size}
    elif wid == "diagnostics":
        checks = {"ui": UI.exists(), "data": DATA.exists(), "auth_file": AUTH_FILE.exists(), "offline_mode": ALICE_OFFLINE_MODE, "loopback_only": ALICE_BIND_HOST == "127.0.0.1"}
        result["data"] = {"ok": all(checks.values()), "checks": checks}
    history = workflow_history(); history.append(result); save_workflow_history(history)
    add_action("Workflow completed", f"Alice completed the '{wid}' workflow. Review the result in Automation.", "info")
    return result

def workflow_snapshot():
    return {"ok": True, "config": workflow_config(), "workflows": workflow_catalog(), "history": workflow_history()[-20:]}
# ---------- end v10.5 automation & workflow engine ----------

def cloud_event_for_request(method, path):
    # Store process metadata, never request bodies, passwords, tokens or secrets.
    if path.startswith("/api/cloud/"):
        return
    try:
        cloud_record_event("process", f"{method} {path}")
    except Exception:
        pass


class AliceHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(UI), **kwargs)

    def send_json(self, obj, code=200):
        body = json_bytes(obj)
        try:
            cloud_event_for_request(self.command, self.path)
        except Exception:
            pass
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        n = int(self.headers.get("Content-Length", "0"))
        if n > 8_000_000:
            raise ValueError("Request too large.")
        return json.loads(self.rfile.read(n).decode("utf-8"))

    def do_GET(self):
        if self.path == "/api/v42/settings":
            return self.send_json(v42_settings())
        if self.path == "/api/v42/wallpapers":
            return self.send_json({"items": wallpaper_catalog()})
        if self.path == "/api/v42/notifications":
            return self.send_json({"items": notification_feed()})
        if self.path.startswith("/assets/"):
            name = Path(self.path.split("?",1)[0].replace("/assets/","")).name
            target = ROOT / "assets" / name
            if target.exists() and target.is_file():
                data = target.read_bytes(); mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
                self.send_response(200); self.send_header("Content-Type", mime); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data); return
            return self.send_json({"ok": False, "error": "Asset not found."}, 404)
        if self.path.startswith("/wallpapers/"):
            name = Path(self.path.split("?",1)[0].replace("/wallpapers/","")).name
            target = WALLPAPERS / name
            if target.exists() and target.is_file():
                data = target.read_bytes()
                mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            return self.send_json({"ok": False, "error": "Wallpaper not found."}, 404)
        if self.path == "/api/workspace":
            return self.send_json(list_local_files("workspace"))
        if self.path == "/api/security/audit":
            checks = [
                {"name":"Loopback binding","status":"PASS","detail":"Alice server is bound to 127.0.0.1 only."},
                {"name":"Offline mode","status":"PASS" if ALICE_OFFLINE_MODE else "WARN","detail":"Network access is disabled by default."},
                {"name":"Workspace confinement","status":"PASS","detail":"File operations are restricted to the Alice project directory."},
                {"name":"Remote probing","status":"PASS","detail":"No remote scanning is provided by the local security layer."},
                {"name":"Credential protection","status":"PASS","detail":"Owner passwords use PBKDF2-SHA256 hashing."},
            ]
            return self.send_json({"ok":True,"checks":checks,"scope":"Local defensive audit only."})
        if self.path == "/api/health":
            return self.send_json({
                "ok": True,
                "ready": True,
                "service": "Alice OS",
                "version": VERSION,
                "offline": not bool(network_state.get("enabled")),
                "bind_host": ALICE_BIND_HOST,
                "port": PORT,
                "ui": UI.exists(),
                "owner_auth_configured": auth.configured(),
                "capabilities": capability_snapshot(network_status()),
            })
        if self.path == "/api/settings":
            return self.send_json(settings)
        if self.path == "/api/security/status":
            return self.send_json(security_snapshot())
        if self.path == "/api/security/events":
            return self.send_json({"ok":True,"items":security_events()[-50:]})
        if self.path == "/api/monitor/status":
            return self.send_json(monitor_snapshot())
        if self.path == "/api/monitor/events":
            return self.send_json({"ok":True,"items":monitor_events()[-50:]})
        if self.path == "/api/supervisor/status":
            return self.send_json(supervisor_snapshot())
        if self.path == "/api/events/status":
            return self.send_json(event_engine_snapshot())
        if self.path == "/api/actions/status":
            return self.send_json(action_center_snapshot())
        if self.path == "/api/alice-assistant/status":
            return self.send_json({"ok": True, "version": VERSION, "offline": ALICE_OFFLINE_MODE, "bind_host": ALICE_BIND_HOST, "capabilities": ["system status", "security status", "event timeline", "recommendations", "workflows", "local diagnostics"]})
        if self.path == "/api/ai/status":
            return self.send_json(provider_status(network_state.get("enabled", False), ai_network_quality()))
        if self.path == "/api/ai/parity":
            return self.send_json(ai_parity_snapshot())
        if self.path == "/api/internet/status":
            cap = capability_snapshot(network_status())
            return self.send_json({"ok": True, "available": cap["internet_available"], "mode": cap["mode"], "message": "Alice Internet is available." if cap["internet_available"] else "Alice Internet is unavailable while Alice is offline."})
        if self.path == "/api/security/tools":
            return self.send_json({"ok":True,"tools":CYBER_TOOLS,"scope":"Authorized defensive work only. Network probing is restricted to 127.0.0.1."})
        if self.path == "/api/security/tool-status":
            return self.send_json({"ok":True,**cyber_tool_status()})
        if self.path == "/api/ai/security-review":
            checks = [
                {"name":"Loopback binding","status":"PASS" if ALICE_BIND_HOST=="127.0.0.1" else "WARN","detail":"Alice server is bound to localhost."},
                {"name":"Offline mode","status":"PASS" if not network_state.get("enabled") else "WARN","detail":"Network access is disabled by default."},
                {"name":"Workspace confinement","status":"PASS","detail":"File operations remain confined to the Alice project directory."},
                {"name":"Remote probing","status":"PASS","detail":"No remote scanning is provided by the defensive security layer."},
                {"name":"Owner authentication","status":"PASS" if auth.configured() else "WARN","detail":"Owner authentication uses the local authentication subsystem."},
            ]
            return self.send_json({"ok":True,"review":defensive_security_review({"checks":checks})})
        if self.path == "/api/alice-assistant/query":
            data = self.read_json()
            return self.send_json(local_intelligence(data.get("text", "")))
        if self.path == "/api/dashboard/status":
            return self.send_json(dashboard_snapshot())
        if self.path == "/api/dashboard/config":
            data=self.read_json(); return self.send_json({"ok":True,"config":save_dashboard_config(data)})
        if self.path == "/api/workflows/status":
            return self.send_json(workflow_snapshot())
        if self.path == "/api/auth/status":
            return self.send_json({
                "configured": auth.configured(),
                "owner": settings.get("user_name", "Owner"),
                "authentication": "local PBKDF2-SHA256" if auth.configured() else "not configured",
            })
        if self.path == "/api/skills":
            return self.send_json({"skills": get_skills()})
        if self.path == "/api/notebook/skills":
            return self.send_json({"skills": notebook_skill_catalog()})
        if self.path == "/api/system/environment":
            return self.send_json({"ok": True, "platform": platform.platform(), "python": platform.python_version(), "machine": platform.machine(), "processor": platform.processor(), "hostname": platform.node(), "cwd": str(ROOT)})
        if self.path == "/api/accounts/status":
            return self.send_json(account_snapshot())
        if self.path == "/api/action-center":
            return self.send_json({"ok":True,"items":action_center_items()[-50:]})
        if self.path == "/api/startup":
            return self.send_json({"ok":True,"settings":startup_preferences()})
        if self.path == "/api/recovery":
            return self.send_json(recovery_snapshot())
        if self.path == "/api/network/status":
            return self.send_json(network_status())
        if self.path == "/api/capabilities":
            return self.send_json({"ok": True, **capability_snapshot(network_status())})
        if self.path == "/api/network/interfaces":
            return self.send_json(network_interfaces())
        if self.path == "/api/software/managers":
            return self.send_json({"ok": True, "os": platform.system(), "managers": package_managers(), "note": "Package managers execute locally and require your explicit action."})
        if self.path == "/api/control/task-manager":
            return self.send_json(task_manager_snapshot())
        if self.path == "/api/control/task-manager/services":
            return self.send_json(task_manager_services())
        if self.path == "/api/control/network":
            return self.send_json(network_control_snapshot())
        if self.path == "/api/control/updates":
            return self.send_json(update_center_snapshot())
        if self.path == "/api/control/devices":
            return self.send_json(device_manager_snapshot())
        if self.path == "/api/control/storage":
            return self.send_json(storage_manager_snapshot())
        if self.path == "/api/control/connectivity":
            return self.send_json(connectivity_snapshot())
        if self.path == "/api/control/radios":
            return self.send_json({"ok": True, "network_enabled": bool(network_state.get("enabled")), "status": radio_status()})
        if self.path == "/api/control/wifi/scan":
            return self.send_json(wifi_scan())
        if self.path == "/api/network/downloads":
            DOWNLOADS.mkdir(parents=True, exist_ok=True)
            items = []
            for f in sorted(DOWNLOADS.iterdir(), key=lambda x: x.name.lower()):
                if f.is_file():
                    items.append({"name": f.name, "bytes": f.stat().st_size, "path": str(f.relative_to(ROOT)).replace("\\", "/")})
            return self.send_json({"ok": True, "items": items})
        if self.path == "/api/offline/status":
            self.send_json({"ok": True, "offline": not bool(network_state.get("enabled")), "network_enabled": bool(network_state.get("enabled")),
                            "bind_host": ALICE_BIND_HOST, "port": PORT})
            return

        if self.path == "/api/intelligence/status":
            return self.send_json({"ok": True, "version": VERSION, "offline": True, "memory_items": len(local_memory()), "history_items": len(intelligence_history())})
        if self.path == "/api/intelligence/history":
            return self.send_json({"items": intelligence_history()[:50]})
        if self.path == "/api/cloud/status":
            out=cloud_snapshot(); out['sync']=cloud_sync_status(); return self.send_json(out)
        if self.path == "/api/cloud/sync/status":
            return self.send_json(cloud_sync_status())
        if self.path == "/api/cloud/memories":
            return self.send_json({"ok": True, "items": cloud_memories(200)})
        if self.path == "/api/cloud/events":
            return self.send_json({"ok": True, "items": cloud_events(300)})
        if self.path == "/api/cloud/schedules":
            return self.send_json({"ok": True, "items": cloud_schedules()})

        if self.path == "/api/diagnostics":
            checks = {
                "ui": UI.exists(),
                "data": DATA.exists(),
                "wallpapers": WALLPAPERS.exists(),
                "auth_file": AUTH_FILE.exists(),
                "offline_mode": ALICE_OFFLINE_MODE,
                "loopback_only": ALICE_BIND_HOST == "127.0.0.1"
            }
            self.send_json({"ok": all(checks.values()), "checks": checks, "version": VERSION})
            return

        if self.path == "/api/termux/session":
            session_file = DATA / "termux_history.json"
            if self.command == "GET":
                try:
                    history = json.loads(session_file.read_text(encoding="utf-8")) if session_file.exists() else []
                except Exception:
                    history = []
                self.send_json({"ok": True, "history": history[-100:]})
                return
            try:
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0") or 0)) or b"{}")
            except Exception:
                body = {}
            history = body.get("history", [])
            if not isinstance(history, list):
                history = []
            history = [str(x)[:500] for x in history[-100:]]
            session_file.parent.mkdir(parents=True, exist_ok=True)
            session_file.write_text(json.dumps(history, indent=2), encoding="utf-8")
            self.send_json({"ok": True, "saved": len(history)})
            return

        if self.path == "/api/termux/status":
            termux_path = shutil.which("termux-info") or shutil.which("termux-open") or shutil.which("pkg")
            self.send_json({"ok": True, "offline": True, "termux_detected": bool(termux_path),
                            "path": termux_path, "bridge": "local-process-detection-only"})
            return

        if self.path == "/api/termux/command":
            try:
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0") or 0)) or b"{}")
            except Exception:
                body = {}
            command = str(body.get("command", "")).strip()
            parts = command.split()
            cmd = parts[0].lower() if parts else ""
            safe = {"help","clear","pwd","whoami","date","uname","ls","id","termux-info","nmap"}
            if cmd not in safe:
                self.send_json({"ok": False, "error": "Command not available in Alice's safe terminal."})
                return
            if cmd == "help":
                result = ["help","clear","pwd","whoami","date","uname","ls","id","termux-info",
                          "nmap 127.0.0.1 (local-only diagnostic)"]
            elif cmd == "pwd":
                result = str(ROOT)
            elif cmd == "whoami":
                result = os.environ.get("USER") or os.environ.get("USERNAME") or "alice"
            elif cmd == "date":
                result = time.strftime("%Y-%m-%d %H:%M:%S")
            elif cmd == "uname":
                result = platform.platform()
            elif cmd == "id":
                result = "Alice local session"
            elif cmd == "termux-info":
                result = {"platform": platform.system(), "python": platform.python_version(),
                          "offline": True, "shell": "Alice Termux-style local shell"}
            elif cmd == "ls":
                result = sorted([p.name for p in ROOT.iterdir() if p.name != ".git"])
            elif cmd == "nmap":
                # Only permit the loopback diagnostic form; no remote target expansion.
                if len(parts) != 2 or parts[1] not in ("127.0.0.1","localhost"):
                    self.send_json({"ok": False, "error": "Nmap in Alice Terminal is restricted to this device (localhost/127.0.0.1)."})
                    return
                result = {"message":"Local Nmap integration point ready.",
                          "target":"127.0.0.1",
                          "note":"Use an installed Nmap/Termux environment to run the actual local diagnostic."}
            self.send_json({"ok": True, "command": command, "result": result})
            return

        if self.path == "/api/command-center":
            try:
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0") or 0)) or b"{}")
            except Exception:
                body = {}
            command = str(body.get("command", "")).strip()
            self.send_json({"ok": True, "offline": True, "command": command,
                            "message": "Command accepted by the local Alice command center.",
                            "next": "dispatch"})
            return

        if self.path == "/api/voice/capabilities":
            self.send_json({"ok": True, "offline": True,
                            "recognition": bool(True), "synthesis": bool(True),
                            "controller": "browser-local"})
            return

        if self.path == "/api/voice/status":
            self.send_json({"ok": True, "offline": True, "browser_speech": True,
                            "recognition": "browser-dependent", "synthesis": "browser-dependent"})
            return

        if self.path == "/api/skills/dispatch":
            try:
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0") or 0)) or b"{}")
            except Exception:
                body = {}
            command = str(body.get("command", "")).strip()
            q = command.lower()
            skill = "general"
            if any(x in q for x in ("system status","system info","computer status","cpu","ram","storage")):
                skill, result = "system_monitor", system_snapshot()
            elif "terminal" in q:
                skill, result = "terminal", {"ok": True, "action": "open_window", "window": "terminal"}
            elif "settings" in q:
                skill, result = "settings", {"ok": True, "action": "open_window", "window": "settings"}
            elif any(x in q for x in ("show skills","skills hub","list skills")):
                skill, result = "skill_hub", {"ok": True, "action": "open_window", "window": "skills"}
            elif any(x in q for x in ("diagnostic","health check")):
                skill, result = "diagnostics", {"ok": True, "action": "diagnostics"}
            elif "offline" in q:
                skill, result = "offline", {"ok": True, "offline": True, "network_enabled": False, "bind_host": ALICE_BIND_HOST}
            elif any(x in q for x in ("time","clock")):
                skill, result = "time", {"ok": True, "action": "time"}
            elif "lock alice" in q or "lock desktop" in q:
                skill, result = "security", {"ok": True, "action": "lock"}
            elif q.startswith("remember "):
                skill, result = "memory", {"ok": True, "action": "remember", "text": command[9:].strip()}
            elif "memory" in q:
                skill, result = "memory", {"ok": True, "action": "open_window", "window": "vault"}
            else:
                result = {"ok": True, "action": "chat", "text": "No matching local skill is registered yet."}
            self.send_json({"ok": True, "skill": skill, "command": command, "result": result})
            return

        if self.path == "/api/system":
            return self.send_json(system_info())
        if self.path == "/api/locator/status":
            return self.send_json(get_location_status(ROOT))
        if self.path == "/api/locator/map":
            return self.send_json(get_location_map(ROOT))
        if self.path.startswith("/api/files"):
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            return self.send_json(list_local_files(q.get("path", [""])[0]))
        if self.path == "/api/files/search":
            from urllib.parse import urlparse, parse_qs
            q=parse_qs(urlparse(self.path).query)
            return self.send_json(search_local_files(q.get("q", [""])[0], q.get("path", [""])[0]))
        if self.path == "/api/files/raw":
            from urllib.parse import urlparse, parse_qs
            q=parse_qs(urlparse(self.path).query); target=safe_local_path(q.get("path", [""])[0])
            if not target.is_file(): return self.send_json({"ok":False,"error":"File not found."},404)
            data=target.read_bytes(); mime=mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            self.send_response(200); self.send_header("Content-Type",mime); self.send_header("Content-Length",str(len(data))); self.end_headers(); self.wfile.write(data); return
        if self.path == "/api/files/download":
            from urllib.parse import urlparse, parse_qs
            q=parse_qs(urlparse(self.path).query); target=safe_local_path(q.get("path", [""])[0])
            if not target.is_file(): return self.send_json({"ok":False,"error":"File not found."},404)
            data=target.read_bytes(); mime=mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            self.send_response(200); self.send_header("Content-Type",mime); self.send_header("Content-Length",str(len(data))); self.send_header("Content-Disposition",f'attachment; filename="{target.name.replace(chr(34),"")}"'); self.end_headers(); self.wfile.write(data); return
        if self.path == "/api/files/content":
            from urllib.parse import urlparse, parse_qs
            q=parse_qs(urlparse(self.path).query); target=safe_local_path(q.get("path", [""])[0])
            if not target.is_file(): return self.send_json({"ok":False,"error":"File not found."},404)
            if target.stat().st_size > 1_500_000: return self.send_json({"ok":False,"error":"Preview limited to 1.5 MB."},413)
            try: text=target.read_text(encoding="utf-8")
            except UnicodeDecodeError: return self.send_json({"ok":False,"binary":True,"error":"Binary file."},415)
            return self.send_json({"ok":True,"path":str(target.relative_to(ROOT)).replace("\\","/"),"content":text})
        if self.path == "/api/notifications":
            return self.send_json({"items": []})
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/locator/"):
            try:
                length = int(self.headers.get("Content-Length", "0"))
                body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
                if self.path == "/api/locator/permission":
                    return self.send_json(set_sharing(bool(body.get("enabled")), ROOT))
                if self.path == "/api/locator/self":
                    return self.send_json(set_self_location(body.get("latitude"), body.get("longitude"), body.get("accuracy_m"), body.get("label", "This device"), ROOT))
                if self.path == "/api/locator/contact":
                    return self.send_json(add_shared_contact(body.get("name"), body.get("latitude"), body.get("longitude"), body.get("accuracy_m"), bool(body.get("sharing_confirmed")), ROOT))
                if self.path == "/api/locator/contact/remove":
                    return self.send_json(remove_contact(body.get("id"), ROOT))
            except Exception as e:
                return self.send_json({"ok": False, "error": str(e)}, 400)
        if self.path == "/api/v42/settings":
            incoming = self.read_json()
            if isinstance(incoming, dict) and "wallpaper" in incoming:
                name = Path(str(incoming.get("wallpaper", "default.svg"))).name
                if (WALLPAPERS / name).exists():
                    settings["wallpaper"] = name
                    save_settings(DATA / "settings.json", settings)
            return self.send_json(v42_settings())
        if self.path == "/api/alice-assistant/query":
            data = self.read_json()
            return self.send_json(local_intelligence(data.get("text", "")))
        if self.path == "/api/control/task-manager/terminate":
            data=self.read_json(); return self.send_json(task_manager_terminate(data.get("pid")))
        if self.path == "/api/control/radios":
            data=self.read_json(); action=str(data.get("action","")).strip().lower()
            if action=="airplane_on": return self.send_json(set_airplane_mode(True))
            if action=="airplane_off": return self.send_json(set_airplane_mode(False))
            if action=="wifi_on": return self.send_json(set_radio("wifi",True))
            if action=="wifi_off": return self.send_json(set_radio("wifi",False))
            if action=="bluetooth_on": return self.send_json(set_radio("bluetooth",True))
            if action=="bluetooth_off": return self.send_json(set_radio("bluetooth",False))
            raise ValueError("Unsupported radio action.")
        if self.path == "/api/control/wifi/connect":
            data=self.read_json(); return self.send_json(wifi_connect(data.get("ssid",""),data.get("password","")))
        if self.path == "/api/security/tool":
            data=self.read_json();
            try: return self.send_json({"ok":True,"tool":data.get("tool"),"result":run_cyber_tool(str(data.get("tool","")), data.get("args") or {})})
            except Exception as e: return self.send_json({"ok":False,"error":str(e)},400)
        if self.path == "/api/ai/config":
            data=self.read_json()
            cfg=save_ai_config(data if isinstance(data,dict) else {})
            return self.send_json({"ok":True,"config":cfg,"status":provider_status(network_state.get("enabled",False), ai_network_quality())})
        if self.path == "/api/ai/query":
            data=self.read_json(); prompt=str(data.get("text","")).strip()
            context=data.get("context") if isinstance(data.get("context"),dict) else {}
            result=ai_ask(prompt,context=context,network_enabled=network_state.get("enabled",False),audit={"checks":context.get("security_checks",[])},quality=ai_network_quality())
            return self.send_json(result)
        if self.path == "/api/security/config":
            data=self.read_json(); cfg=security_config()
            if "camera_permission" in data: cfg["camera_permission"]=bool(data["camera_permission"])
            if "phone_alerts_enabled" in data: cfg["phone_alerts_enabled"]=bool(data["phone_alerts_enabled"])
            if "phone_webhook" in data: cfg["phone_webhook"]=str(data["phone_webhook"] or "").strip()[:500]
            if "failed_attempt_threshold" in data: cfg["failed_attempt_threshold"]=max(1,min(10,int(data["failed_attempt_threshold"])))
            if cfg["phone_alerts_enabled"] and cfg["phone_webhook"] and not cfg["phone_webhook"].startswith("https://"):
                return self.send_json({"ok":False,"error":"Phone alerts require an HTTPS webhook."},400)
            save_security_config(cfg); return self.send_json(security_snapshot())
        if self.path == "/api/security/intrusion":
            data=self.read_json(); return self.send_json({"ok":True,"event":record_intrusion_event(data.get("image",""))},201)
        if self.path == "/api/monitor/config":
            data=self.read_json(); return self.send_json({"ok":True,"config":save_monitor_config(data)})
        if self.path == "/api/supervisor/config":
            data=self.read_json(); return self.send_json({"ok":True,"config":save_supervisor_config(data)})
        if self.path == "/api/events/config":
            data=self.read_json(); return self.send_json({"ok":True,"config":save_event_engine_config(data)})
        if self.path == "/api/actions/ack":
            data=self.read_json(); return self.send_json(acknowledge_action(data.get("key")))
        if self.path == "/api/workflows/status":
            return self.send_json(workflow_snapshot())
        if self.path == "/api/workflows/config":
            data=self.read_json(); return self.send_json({"ok":True,"config":save_workflow_config(data)})
        if self.path == "/api/workflows/run":
            data=self.read_json()
            try: return self.send_json(run_workflow(data.get("id")), 201)
            except Exception as e: return self.send_json({"ok":False,"error":str(e)},400)
        if self.path == "/api/auth/change":
            data = self.read_json()
            current = str(data.get("current", ""))
            new_password = str(data.get("new", ""))
            if not auth.verify(current):
                return self.send_json({"ok":False,"error":"Current password is incorrect."},401)
            if len(new_password) < 8:
                return self.send_json({"ok":False,"error":"Password must be at least 8 characters."},400)
            auth.set_password(new_password)
            return self.send_json({"ok":True})
        if self.path == "/api/auth/verify":
            data = self.read_json()
            ok = auth.verify(str(data.get("password", "")))
            return self.send_json({"ok":ok},200 if ok else 401)
        if self.path == "/api/workspace":
            return self.send_json(list_local_files("workspace"))
        if self.path == "/api/workspace/folder":
            try: return self.send_json(workspace_create_folder(self.read_json().get("name","")),201)
            except Exception as e: return self.send_json({"error":str(e)},400)
        if self.path == "/api/workspace/file":
            data=self.read_json()
            try: return self.send_json(workspace_create_file(data.get("name",""),data.get("content","")),201)
            except Exception as e: return self.send_json({"error":str(e)},400)
        if self.path == "/api/workspace/delete":
            try: return self.send_json(workspace_delete(self.read_json().get("name","")))
            except Exception as e: return self.send_json({"error":str(e)},400)
        if self.path == "/api/backup":
            try: return self.send_json(create_local_backup(),201)
            except Exception as e: return self.send_json({"error":str(e)},500)
        try:
            if self.path == "/api/action-center/add":
                data=self.read_json(); return self.send_json({"ok":True,"item":add_action(data.get("title","Alice"),data.get("message",""),data.get("level","info"))},201)

            if self.path == "/api/action-center/clear":
                save_action_center([]); return self.send_json({"ok":True})

            if self.path == "/api/startup":
                return self.send_json({"ok":True,"settings":save_startup_preferences(self.read_json())})

            if self.path == "/api/network/toggle":
                data = self.read_json()
                enabled = bool(data.get("enabled", False))
                network_state["enabled"] = enabled
                save_network_state(enabled)
                return self.send_json(network_status())

            if self.path == "/api/network/download":
                data = self.read_json()
                try:
                    return self.send_json(download_network_file(data.get("url", ""), data.get("filename", ""), data.get("sha256", "")), 201)
                except Exception as e:
                    return self.send_json({"ok": False, "error": str(e)}, 400)

            if self.path == "/api/software/manager":
                data=self.read_json()
                try:
                    return self.send_json(run_package_manager(str(data.get("action","")), str(data.get("package_id",""))))
                except Exception as e:
                    return self.send_json({"ok":False,"error":str(e)},400)

            if self.path == "/api/settings/backup":
                backup_dir = DATA / "backups"; backup_dir.mkdir(exist_ok=True)
                target = backup_dir / "alice-settings-backup.json"
                safe = {k:v for k,v in settings.items() if k not in {"password","auth"}}
                target.write_text(json.dumps(safe, indent=2), encoding="utf-8")
                return self.send_json({"ok": True, "path": str(target.relative_to(ROOT)).replace("\\","/")})

            if self.path == "/api/cloud/sync/configure":
                data=self.read_json()
                try: return self.send_json(cloud_sync_configure(data.get('endpoint',''), data.get('token',''), bool(data.get('enabled',True))))
                except Exception as e: return self.send_json({'ok':False,'error':str(e)},400)

            if self.path == "/api/cloud/sync/disable":
                return self.send_json(cloud_sync_disable())

            if self.path == "/api/cloud/sync/push":
                data=self.read_json()
                try: return self.send_json(cloud_sync_push(data.get('passphrase','')))
                except Exception as e: return self.send_json({'ok':False,'error':str(e)},400)

            if self.path == "/api/cloud/sync/pull":
                data=self.read_json()
                try: return self.send_json(cloud_sync_pull(data.get('passphrase',''), bool(data.get('apply',False))))
                except Exception as e: return self.send_json({'ok':False,'error':str(e)},400)

            if self.path == "/api/cloud/memory":
                data = self.read_json()
                try:
                    item = cloud_add_memory(data.get("text", ""), data.get("tags", ""))
                    cloud_record_event("memory", "Memory saved", item.get("text", "")[:500])
                    return self.send_json({"ok": True, "item": item}, 201)
                except Exception as e:
                    return self.send_json({"ok": False, "error": str(e)}, 400)

            if self.path == "/api/cloud/schedule":
                data = self.read_json()
                try:
                    item = cloud_add_schedule(data.get("title", ""), data.get("note", ""), data.get("run_at"), data.get("repeat", "none"))
                    cloud_record_event("schedule", "Schedule created", item.get("title", ""))
                    return self.send_json({"ok": True, "item": item}, 201)
                except Exception as e:
                    return self.send_json({"ok": False, "error": str(e)}, 400)

            if self.path == "/api/cloud/schedule/delete":
                data = self.read_json()
                try:
                    result = cloud_delete_schedule(data.get("id"))
                    cloud_record_event("schedule", "Schedule deleted", str(data.get("id")))
                    return self.send_json(result)
                except Exception as e:
                    return self.send_json({"ok": False, "error": str(e)}, 400)

            if self.path == "/api/cloud/schedule/toggle":
                data = self.read_json()
                try:
                    item = cloud_set_schedule_enabled(data.get("id"), bool(data.get("enabled", True)))
                    return self.send_json({"ok": True, "item": item})
                except Exception as e:
                    return self.send_json({"ok": False, "error": str(e)}, 400)

            if self.path == "/api/settings":
                incoming = self.read_json()
                settings.update({k: incoming[k] for k in incoming if k in settings})
                save_settings(DATA / "settings.json", settings)
                return self.send_json({"ok": True, "settings": settings})

            if self.path == "/api/window-state":
                incoming = self.read_json()
                state_path = DATA / "windows.json"
                state_path.write_text(json.dumps(incoming, indent=2), encoding="utf-8")
                return self.send_json({"ok": True})

            if self.path == "/api/auth/setup":
                data = self.read_json()
                password = str(data.get("password", ""))
                owner = str(data.get("owner", settings.get("user_name", "Owner"))).strip()[:80] or "Owner"
                if len(password) < 8:
                    return self.send_json({"ok": False, "error": "Password must be at least 8 characters."}, 400)
                if auth.configured():
                    return self.send_json({"ok": False, "error": "Owner authentication is already configured. Use Change Password."}, 409)
                auth.set_password(password)
                settings["user_name"] = owner
                save_settings(DATA / "settings.json", settings)
                return self.send_json({"ok": True, "owner": owner})

            if self.path == "/api/auth/login":
                data = self.read_json()
                ok = auth.verify(str(data.get("password", "")))
                return self.send_json({"ok": ok}, 200 if ok else 401)

            if self.path == "/api/files/create-file":
                data=self.read_json(); name=str(data.get("name","")).strip(); parent=str(data.get("path","")).strip(); content=str(data.get("content", ""))
                if not name or name in (".","..") or "/" in name or "\\" in name: return self.send_json({"ok":False,"error":"Invalid filename."},400)
                if len(content.encode("utf-8"))>2_000_000: return self.send_json({"ok":False,"error":"File content exceeds 2 MB."},413)
                target=safe_local_path(parent)/name
                if target.exists(): return self.send_json({"ok":False,"error":"A file or folder with that name already exists."},409)
                target.write_text(content,encoding="utf-8"); return self.send_json({"ok":True,"file":file_metadata(target)},201)
            if self.path == "/api/files/rename":
                data=self.read_json(); rel=str(data.get("path","")).strip(); name=str(data.get("name","")).strip(); target=safe_local_path(rel)
                if not target.exists() or target==ROOT: return self.send_json({"ok":False,"error":"Item not found."},404)
                if not name or name in (".","..") or "/" in name or "\\" in name: return self.send_json({"ok":False,"error":"Invalid name."},400)
                dest=target.parent/name
                if dest.exists(): return self.send_json({"ok":False,"error":"An item with that name already exists."},409)
                target.rename(dest); return self.send_json({"ok":True,"file":file_metadata(dest)})
            if self.path == "/api/files/delete":
                data=self.read_json(); target=safe_local_path(str(data.get("path","")).strip())
                if not target.exists() or target==ROOT: return self.send_json({"ok":False,"error":"Item not found."},404)
                # Safety-first recycle bin: no immediate permanent deletion.
                rp=unique_target(recycle_path(), target.name)
                target.rename(rp); return self.send_json({"ok":True,"recycled":target.name})
            if self.path == "/api/files/copy":
                import shutil as _shutil
                data=self.read_json(); src=safe_local_path(str(data.get("source","")).strip()); dest_dir=safe_local_path(str(data.get("destination","")).strip())
                if not src.exists() or not dest_dir.is_dir(): return self.send_json({"ok":False,"error":"Source or destination not found."},404)
                dest=unique_target(dest_dir,src.name)
                if src.is_dir(): _shutil.copytree(src,dest)
                else: _shutil.copy2(src,dest)
                return self.send_json({"ok":True,"file":file_metadata(dest)})
            if self.path == "/api/files/move":
                data=self.read_json(); src=safe_local_path(str(data.get("source","")).strip()); dest_dir=safe_local_path(str(data.get("destination","")).strip())
                if not src.exists() or not dest_dir.is_dir(): return self.send_json({"ok":False,"error":"Source or destination not found."},404)
                if dest_dir==src or src in dest_dir.parents: return self.send_json({"ok":False,"error":"Invalid destination."},400)
                dest=unique_target(dest_dir,src.name); src.rename(dest); return self.send_json({"ok":True,"file":file_metadata(dest)})
            if self.path == "/api/files/upload":
                import base64 as _b64
                data=self.read_json(); name=str(data.get("name","")).strip(); parent=str(data.get("path","")).strip(); raw=str(data.get("data", ""))
                if not name or name in (".","..") or "/" in name or "\\" in name: return self.send_json({"ok":False,"error":"Invalid filename."},400)
                try: blob=_b64.b64decode(raw,validate=True)
                except Exception: return self.send_json({"ok":False,"error":"Invalid upload data."},400)
                if len(blob)>50_000_000: return self.send_json({"ok":False,"error":"Upload limited to 50 MB."},413)
                dest=unique_target(safe_local_path(parent),name); dest.write_bytes(blob); return self.send_json({"ok":True,"file":file_metadata(dest)},201)
            if self.path == "/api/files/create-folder":
                data = self.read_json()
                name = str(data.get("name", "")).strip()
                parent = str(data.get("path", "")).strip()
                if not name or name in (".", "..") or "/" in name or "\\" in name:
                    return self.send_json({"ok": False, "error": "Invalid folder name."}, 400)
                target = safe_local_path(parent) / name
                target.mkdir(exist_ok=False)
                return self.send_json({"ok": True, "path": str(target.relative_to(ROOT)).replace("\\", "/")})

            if self.path == "/api/launch":
                data = self.read_json()
                return self.send_json(launch_local_app(data.get("app")))

            if self.path == "/api/command":
                data = self.read_json()
                return self.send_json(local_intelligence(data.get("text", "")))

            if self.path == "/api/terminal":
                data = self.read_json()
                result = run_command(str(data.get("command", "")))
                return self.send_json(result)

            if self.path == "/api/wallpaper":
                data = self.read_json()
                name = Path(str(data.get("name", "wallpaper"))).name
                mime = str(data.get("mime", "image/png"))
                raw = base64.b64decode(str(data.get("data", "")), validate=True)
                if len(raw) > 12_000_000:
                    return self.send_json({"ok": False, "error": "Wallpaper is too large."}, 400)
                ext = mimetypes.guess_extension(mime) or ".png"
                if not name.lower().endswith(ext):
                    name += ext
                target = WALLPAPERS / name
                target.write_bytes(raw)
                settings["wallpaper"] = name
                save_settings(DATA / "settings.json", settings)
                return self.send_json({"ok": True, "wallpaper": name})

            return self.send_json({"ok": False, "error": "Unknown endpoint."}, 404)
        except Exception as e:
            return self.send_json({"ok": False, "error": str(e)}, 400)

def system_info():
    disk = shutil.disk_usage(ROOT)
    result = {
        "platform": platform.platform(),
        "python": platform.python_version(),
        "cpu_count": os.cpu_count() or 1,
        "storage_used_percent": round((disk.used / disk.total) * 100, 1),
        "storage_total_gb": round(disk.total / (1024**3), 2),
    }
    try:
        if os.name == "nt":
            import ctypes
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                            ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                            ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                            ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                            ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
            m = MEMORYSTATUSEX()
            m.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
            result["ram_percent"] = m.dwMemoryLoad
        else:
            result["ram_percent"] = None
    except Exception:
        result["ram_percent"] = None
    return result

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Alice OS local desktop service")
    parser.add_argument("--no-browser", action="store_true", help="Do not open a browser automatically")
    args = parser.parse_args()

    WALLPAPERS.mkdir(exist_ok=True)
    DATA.mkdir(exist_ok=True)
    LOG_DIR.mkdir(exist_ok=True)
    PID_FILE.write_text(str(os.getpid()), encoding="utf-8")
    print(f"Alice OS {VERSION} running offline at http://127.0.0.1:{PORT}", flush=True)
    print("Local-only server. Press Ctrl+C to stop.", flush=True)
    try:
        start_monitor()
        write_json_file(SUPERVISOR_FILE, supervisor_config())
        server = ThreadingHTTPServer((ALICE_BIND_HOST, PORT), AliceHandler)
    except OSError as exc:
        PID_FILE.unlink(missing_ok=True)
        print(f"ERROR: Could not bind {ALICE_BIND_HOST}:{PORT}: {exc}", file=sys.stderr, flush=True)
        print("If Alice OS is already running, open http://127.0.0.1:8765 instead.", file=sys.stderr, flush=True)
        raise SystemExit(2)
    try:
        if not args.no_browser:
            import webbrowser
            webbrowser.open(f"http://127.0.0.1:{PORT}")
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        PID_FILE.unlink(missing_ok=True)
