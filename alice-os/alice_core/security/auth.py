import hashlib, hmac, json, os
from pathlib import Path

class Auth:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def configured(self):
        if not self.path.exists():
            return False
        try:
            d = json.loads(self.path.read_text(encoding="utf-8"))
            return bool(d.get("salt") and d.get("digest") and d.get("iterations"))
        except Exception:
            return False

    def set_password(self, password):
        salt = os.urandom(16)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 300_000)
        self.path.write_text(json.dumps({
            "algorithm": "PBKDF2-SHA256",
            "iterations": 300_000,
            "salt": salt.hex(),
            "digest": digest.hex()
        }, indent=2), encoding="utf-8")

    def verify(self, password):
        if not self.configured():
            return False
        try:
            d = json.loads(self.path.read_text(encoding="utf-8"))
            check = hashlib.pbkdf2_hmac(
                "sha256", password.encode(), bytes.fromhex(d["salt"]), int(d["iterations"])
            ).hex()
            return hmac.compare_digest(check, d["digest"])
        except Exception:
            return False
