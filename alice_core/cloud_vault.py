"""Alice Cloud Vault: local-first memory, process history and safe reminders.

The vault is intentionally offline-first. A remote sync endpoint can be configured
later; no data leaves the PC unless the owner explicitly enables sync.
"""
from pathlib import Path
import sqlite3
import threading
import time
from datetime import datetime, timedelta

_DB = None
_LOCK = threading.RLock()
_STOP = threading.Event()
_CALLBACK = None


def init(root: Path, notification_callback=None):
    global _DB, _CALLBACK
    dbdir = Path(root) / "data"
    dbdir.mkdir(parents=True, exist_ok=True)
    _DB = dbdir / "alice_cloud.db"
    _CALLBACK = notification_callback
    with _LOCK, sqlite3.connect(_DB) as c:
        c.executescript("""
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS memories(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL,
            tags TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS events(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            detail TEXT DEFAULT '',
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS schedules(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            note TEXT DEFAULT '',
            run_at REAL NOT NULL,
            repeat TEXT DEFAULT 'none',
            enabled INTEGER NOT NULL DEFAULT 1,
            last_run REAL
        );
        CREATE TABLE IF NOT EXISTS cloud_config(
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """)
    return str(_DB)


def _db():
    if _DB is None:
        raise RuntimeError("Cloud Vault is not initialized")
    return sqlite3.connect(_DB)


def add_memory(text, tags=""):
    text = str(text or '').strip()
    if not text: raise ValueError('Memory cannot be empty.')
    now = time.time()
    with _LOCK, _db() as c:
        cur = c.execute('INSERT INTO memories(text,created_at,updated_at,tags) VALUES(?,?,?,?)', (text, now, now, str(tags or '')[:300]))
        return {'id': cur.lastrowid, 'text': text, 'created_at': now, 'tags': str(tags or '')[:300]}


def memories(limit=100):
    limit = max(1, min(500, int(limit)))
    with _LOCK, _db() as c:
        rows = c.execute('SELECT id,text,created_at,updated_at,tags FROM memories ORDER BY id DESC LIMIT ?', (limit,)).fetchall()
    return [{'id':r[0],'text':r[1],'created_at':r[2],'updated_at':r[3],'tags':r[4]} for r in rows]


def record_event(kind, title, detail=''):
    now = time.time()
    with _LOCK, _db() as c:
        cur = c.execute('INSERT INTO events(kind,title,detail,created_at) VALUES(?,?,?,?)', (str(kind)[:80], str(title)[:200], str(detail)[:2000], now))
        return {'id': cur.lastrowid, 'kind': str(kind), 'title': str(title), 'detail': str(detail), 'created_at': now}


def events(limit=200):
    limit = max(1, min(1000, int(limit)))
    with _LOCK, _db() as c:
        rows = c.execute('SELECT id,kind,title,detail,created_at FROM events ORDER BY id DESC LIMIT ?', (limit,)).fetchall()
    return [{'id':r[0],'kind':r[1],'title':r[2],'detail':r[3],'created_at':r[4]} for r in rows]


def add_schedule(title, note, run_at, repeat='none'):
    title = str(title or '').strip()[:160]
    note = str(note or '').strip()[:1000]
    if not title: raise ValueError('Schedule title is required.')
    ts = float(run_at)
    if ts <= time.time() - 60: raise ValueError('Schedule time must be in the future.')
    repeat = str(repeat or 'none').lower()
    if repeat not in {'none','daily','weekly'}: raise ValueError('Repeat must be none, daily or weekly.')
    with _LOCK, _db() as c:
        cur = c.execute('INSERT INTO schedules(title,note,run_at,repeat,enabled) VALUES(?,?,?,?,1)', (title,note,ts,repeat))
        sid = cur.lastrowid
    return schedule(sid)


def schedule(sid):
    with _LOCK, _db() as c:
        r = c.execute('SELECT id,title,note,run_at,repeat,enabled,last_run FROM schedules WHERE id=?', (int(sid),)).fetchone()
    return None if not r else {'id':r[0],'title':r[1],'note':r[2],'run_at':r[3],'repeat':r[4],'enabled':bool(r[5]),'last_run':r[6]}


def schedules(include_disabled=True):
    q = 'SELECT id,title,note,run_at,repeat,enabled,last_run FROM schedules'
    args = ()
    if not include_disabled: q += ' WHERE enabled=1'
    q += ' ORDER BY run_at ASC'
    with _LOCK, _db() as c:
        rows = c.execute(q, args).fetchall()
    return [{'id':r[0],'title':r[1],'note':r[2],'run_at':r[3],'repeat':r[4],'enabled':bool(r[5]),'last_run':r[6]} for r in rows]


def delete_schedule(sid):
    with _LOCK, _db() as c:
        c.execute('DELETE FROM schedules WHERE id=?', (int(sid),))
    return {'ok': True}


def set_schedule_enabled(sid, enabled):
    with _LOCK, _db() as c:
        c.execute('UPDATE schedules SET enabled=? WHERE id=?', (1 if enabled else 0, int(sid)))
    return schedule(sid)


def _advance(ts, repeat):
    dt = datetime.fromtimestamp(ts)
    if repeat == 'daily': return (dt + timedelta(days=1)).timestamp()
    if repeat == 'weekly': return (dt + timedelta(days=7)).timestamp()
    return None


def _tick():
    now = time.time()
    due = []
    with _LOCK, _db() as c:
        rows = c.execute('SELECT id,title,note,run_at,repeat FROM schedules WHERE enabled=1 AND run_at<=?', (now,)).fetchall()
        for sid,title,note,run_at,repeat in rows:
            due.append((sid,title,note,repeat))
            nxt = _advance(run_at, repeat)
            if nxt is None:
                c.execute('UPDATE schedules SET enabled=0,last_run=? WHERE id=?', (now,sid))
            else:
                while nxt <= now: nxt = _advance(nxt, repeat)
                c.execute('UPDATE schedules SET run_at=?,last_run=? WHERE id=?', (nxt,now,sid))
    for sid,title,note,repeat in due:
        record_event('schedule', 'Reminder: '+title, note)
        if _CALLBACK:
            try: _CALLBACK('Alice Schedule', note or title, 'info')
            except Exception: pass


def _worker():
    while not _STOP.wait(10):
        try: _tick()
        except Exception: pass


def start_scheduler():
    if getattr(start_scheduler, '_started', False): return
    start_scheduler._started = True
    threading.Thread(target=_worker, name='alice-cloud-scheduler', daemon=True).start()


def snapshot():
    return {
        'ok': True,
        'mode': 'offline-first',
        'database': str(_DB.name if _DB else 'alice_cloud.db'),
        'memories': len(memories(500)),
        'events': len(events(1000)),
        'schedules': len(schedules()),
        'sync_enabled': False,
        'sync_note': 'Remote sync is disabled until the owner explicitly configures a trusted cloud endpoint.'
    }
