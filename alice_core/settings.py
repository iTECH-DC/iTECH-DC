import json
from pathlib import Path

DEFAULTS = {
    "user_name": "Owner",
    "theme": "dark",
    "accent": "blue",
    "font_size": "normal",
    "wallpaper": "default.svg",
    "voice_enabled": False,
    "offline_mode": True,
    "locator_permission": False,
    "biometric_enabled": False,
    "auto_lock_minutes": 10
}

def load_settings(path):
    path = Path(path)
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        save_settings(path, DEFAULTS.copy())
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        data = {}
    return {**DEFAULTS, **data}

def save_settings(path, settings):
    Path(path).write_text(json.dumps(settings, indent=2), encoding="utf-8")
