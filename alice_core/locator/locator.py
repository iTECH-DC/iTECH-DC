from pathlib import Path
import json


def _data_file(root=None):
    base = Path(root or Path(__file__).resolve().parents[2]) / "data"
    base.mkdir(parents=True, exist_ok=True)
    return base / "locations.json"


def _load(root=None):
    p = _data_file(root)
    if not p.exists():
        return {"sharing_enabled": False, "contacts": [], "self": None}
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
        return {
            "sharing_enabled": bool(d.get("sharing_enabled", False)),
            "contacts": d.get("contacts", []) if isinstance(d.get("contacts", []), list) else [],
            "self": d.get("self") if isinstance(d.get("self"), dict) else None,
        }
    except Exception:
        return {"sharing_enabled": False, "contacts": [], "self": None}


def _save(data, root=None):
    p = _data_file(root)
    p.write_text(json.dumps(data, indent=2), encoding="utf-8")


def get_location_status(root=None):
    data = _load(root)
    return {
        "available": True,
        "permission_required": True,
        "permission_granted": bool(data.get("sharing_enabled")),
        "tracking": False,
        "self_location": data.get("self"),
        "contact_count": len(data.get("contacts", [])),
        "message": "Location Map is permission-based. Alice does not covertly track people or devices.",
    }


def get_location_map(root=None):
    data = _load(root)
    return {"ok": True, "sharing_enabled": bool(data.get("sharing_enabled")),
            "self": data.get("self"), "contacts": data.get("contacts", []),
            "privacy": "Only this device and explicitly shared trusted-contact locations are shown."}


def set_sharing(enabled, root=None):
    data = _load(root)
    data["sharing_enabled"] = bool(enabled)
    _save(data, root)
    return {"ok": True, "sharing_enabled": data["sharing_enabled"]}


def set_self_location(latitude, longitude, accuracy=None, label="This device", root=None):
    data = _load(root)
    if not data.get("sharing_enabled"):
        raise ValueError("Enable Location permission before saving this device location.")
    lat, lon = float(latitude), float(longitude)
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("Invalid coordinates.")
    data["self"] = {"id": "self", "name": str(label)[:80], "latitude": lat, "longitude": lon,
                    "accuracy_m": float(accuracy) if accuracy is not None else None,
                    "source": "device permission", "updated_at": __import__('datetime').datetime.utcnow().isoformat() + "Z"}
    _save(data, root)
    return {"ok": True, "self": data["self"]}


def add_shared_contact(name, latitude, longitude, accuracy=None, sharing_confirmed=False, root=None):
    if not sharing_confirmed:
        raise ValueError("A trusted contact location can only be added when the person has explicitly shared it.")
    lat, lon = float(latitude), float(longitude)
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("Invalid coordinates.")
    data = _load(root)
    cid = "contact-" + __import__('secrets').token_hex(6)
    item = {"id": cid, "name": str(name).strip()[:80] or "Trusted contact", "latitude": lat,
            "longitude": lon, "accuracy_m": float(accuracy) if accuracy is not None else None,
            "source": "explicitly shared location", "updated_at": __import__('datetime').datetime.utcnow().isoformat() + "Z"}
    data["contacts"] = [*data.get("contacts", []), item][-50:]
    _save(data, root)
    return {"ok": True, "contact": item}


def remove_contact(contact_id, root=None):
    data = _load(root)
    before = len(data.get("contacts", []))
    data["contacts"] = [c for c in data.get("contacts", []) if c.get("id") != contact_id]
    _save(data, root)
    return {"ok": True, "removed": before != len(data["contacts"])}
