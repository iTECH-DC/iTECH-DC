"""Minimal encrypted Alice Cloud relay.

Stores opaque ciphertext only. Run behind HTTPS in production. The relay never
receives Alice memory, process history or schedule plaintext.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json, os, secrets, threading, time

HOST=os.getenv('ALICE_CLOUD_HOST','127.0.0.1')
PORT=int(os.getenv('ALICE_CLOUD_PORT','8787'))
TOKEN=os.getenv('ALICE_CLOUD_TOKEN','')
STORE=Path(os.getenv('ALICE_CLOUD_STORE','./cloud_data')); STORE.mkdir(parents=True,exist_ok=True)
LOCK=threading.RLock()

def read_store():
    p=STORE/'sync.json'
    if not p.exists(): return {'revision':0,'ciphertext':''}
    try:return json.loads(p.read_text())
    except:return {'revision':0,'ciphertext':''}

def write_store(x): (STORE/'sync.json').write_text(json.dumps(x),encoding='utf-8')

class H(BaseHTTPRequestHandler):
    def _json(self,obj,code=200):
        b=json.dumps(obj).encode(); self.send_response(code); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def auth(self):
        expected=TOKEN
        supplied=self.headers.get('Authorization','')
        return bool(expected) and secrets.compare_digest(supplied,'Bearer '+expected)
    def do_GET(self):
        if self.path=='/health': return self._json({'ok':True,'service':'Alice Cloud Relay','encrypted_storage':True})
        if self.path=='/v1/sync/pull':
            if not self.auth(): return self._json({'ok':False,'error':'Unauthorized'},401)
            with LOCK: s=read_store()
            return self._json({'ok':True,**s})
        return self._json({'ok':False,'error':'Not found'},404)
    def do_POST(self):
        if self.path!='/v1/sync/push': return self._json({'ok':False,'error':'Not found'},404)
        if not self.auth(): return self._json({'ok':False,'error':'Unauthorized'},401)
        try:
            n=int(self.headers.get('Content-Length','0')); d=json.loads(self.rfile.read(n))
            ct=str(d.get('ciphertext','')); device=str(d.get('device_id',''))[:80]
            if len(ct)>15_000_000 or not device: raise ValueError('Invalid payload')
            with LOCK:
                s=read_store(); rev=int(s.get('revision',0))+1
                write_store({'revision':rev,'ciphertext':ct,'updated_at':time.time(),'last_device':device})
            return self._json({'ok':True,'revision':rev})
        except Exception as e:return self._json({'ok':False,'error':str(e)},400)
    def log_message(self,*args): pass

if __name__=='__main__':
    if not TOKEN: raise SystemExit('Set ALICE_CLOUD_TOKEN before starting the relay.')
    print(f'Alice Cloud Relay listening on {HOST}:{PORT} (ciphertext-only storage)')
    ThreadingHTTPServer((HOST,PORT),H).serve_forever()
