"""Encrypted, owner-controlled Alice Cloud synchronization.

The remote service receives only an encrypted snapshot. The encryption key is
never sent to the server. Sync is disabled until the owner configures it.
"""
from pathlib import Path
import base64, hashlib, json, os, secrets, sqlite3, time, urllib.request, urllib.error
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

_CONFIG = None
_DB = None
ROOT = None


def init(root: Path):
    global _CONFIG, _DB, ROOT
    ROOT = Path(root)
    _DB = ROOT / 'data' / 'alice_cloud.db'
    _CONFIG = ROOT / 'data' / 'alice_cloud_sync.json'
    if not _CONFIG.exists():
        _CONFIG.write_text(json.dumps({
            'enabled': False, 'endpoint': '', 'token': '', 'device_id': secrets.token_hex(12),
            'revision': 0, 'salt': base64.urlsafe_b64encode(os.urandom(16)).decode()
        }, indent=2), encoding='utf-8')
        try: os.chmod(_CONFIG, 0o600)
        except OSError: pass


def _load():
    if _CONFIG is None: raise RuntimeError('Cloud sync is not initialized')
    try: return json.loads(_CONFIG.read_text(encoding='utf-8'))
    except Exception: return {'enabled': False, 'endpoint': '', 'token': '', 'device_id': secrets.token_hex(12), 'revision': 0, 'salt': base64.urlsafe_b64encode(os.urandom(16)).decode()}


def _save(c):
    _CONFIG.write_text(json.dumps(c, indent=2), encoding='utf-8')
    try: os.chmod(_CONFIG, 0o600)
    except OSError: pass


def status():
    c = _load()
    return {'ok': True, 'enabled': bool(c.get('enabled')), 'endpoint': c.get('endpoint',''), 'device_id': c.get('device_id',''), 'revision': int(c.get('revision',0)), 'configured': bool(c.get('endpoint') and c.get('token'))}


def configure(endpoint, token, enabled=True):
    endpoint = str(endpoint or '').strip().rstrip('/')
    token = str(token or '').strip()
    if enabled and (not endpoint or not token): raise ValueError('Endpoint and access token are required.')
    c = _load(); c['endpoint'] = endpoint; c['token'] = token; c['enabled'] = bool(enabled); _save(c)
    return status()


def disable():
    c = _load(); c['enabled'] = False; c['token'] = ''; _save(c); return status()


def _fernet(passphrase):
    if not passphrase: raise ValueError('Cloud encryption passphrase is required.')
    c = _load(); salt = base64.urlsafe_b64decode(c['salt'].encode())
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=600_000)
    key = base64.urlsafe_b64encode(kdf.derive(passphrase.encode('utf-8')))
    return Fernet(key)


def _snapshot():
    with sqlite3.connect(_DB) as db:
        out = {}
        for table in ('memories','events','schedules'):
            cols = [x[1] for x in db.execute(f'PRAGMA table_info({table})').fetchall()]
            rows = [dict(zip(cols, r)) for r in db.execute(f'SELECT {", ".join(cols)} FROM {table}').fetchall()]
            out[table] = rows
    return {'schema': 1, 'created_at': time.time(), 'device_id': _load().get('device_id'), 'data': out}


def _request(method, path, body=None):
    c = _load()
    if not c.get('enabled'): raise RuntimeError('Cloud sync is disabled.')
    url = c['endpoint'] + path
    req = urllib.request.Request(url, method=method, data=(json.dumps(body).encode() if body is not None else None), headers={'Authorization':'Bearer '+c['token'], 'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=12) as r: return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'Cloud server returned HTTP {e.code}.')
    except Exception as e: raise RuntimeError(f'Cloud connection failed: {e}')


def push(passphrase):
    c = _load(); f = _fernet(passphrase); snap = _snapshot()
    token = f.encrypt(json.dumps(snap, separators=(',',':')).encode()).decode()
    remote = _request('POST','/v1/sync/push', {'device_id':c['device_id'],'revision':int(c.get('revision',0)),'ciphertext':token})
    c['revision'] = int(remote.get('revision', c.get('revision',0))); _save(c)
    return {'ok': True, 'revision': c['revision'], 'server_revision': remote.get('revision'), 'bytes': len(token), 'encrypted': True}


def pull(passphrase, replace_local=False):
    c = _load(); f = _fernet(passphrase); remote = _request('GET','/v1/sync/pull')
    if not remote.get('ciphertext'): return {'ok': True, 'changed': False, 'message':'Cloud is empty.'}
    try: snap = json.loads(f.decrypt(remote['ciphertext'].encode()).decode())
    except InvalidToken: raise ValueError('Cloud data could not be decrypted with this passphrase.')
    if not replace_local: return {'ok': True, 'changed': True, 'preview': {'remote_revision':remote.get('revision'), 'device_id':snap.get('device_id'), 'tables':{k:len(v) for k,v in snap.get('data',{}).items()}}, 'requires_explicit_apply': True}
    data = snap.get('data',{})
    with sqlite3.connect(_DB) as db:
        for table in ('memories','events','schedules'):
            rows = data.get(table,[])
            db.execute(f'DELETE FROM {table}')
            cols = [x[1] for x in db.execute(f'PRAGMA table_info({table})').fetchall()]
            for row in rows:
                vals=[row.get(col) for col in cols]
                db.execute(f'INSERT INTO {table} ({", ".join(cols)}) VALUES ({", ".join("?" for _ in cols)})', vals)
    c['revision'] = int(remote.get('revision', c.get('revision',0))); _save(c)
    return {'ok': True, 'changed': True, 'applied': True, 'revision':c['revision']}
