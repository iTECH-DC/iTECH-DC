"""Alice OS 14.0 Offline Voice Engine.

Fully offline speech-to-text (Vosk) and text-to-speech (espeak-ng / piper)
with graceful degradation. No cloud service is ever contacted.

The engine accepts raw 16 kHz mono PCM (Int16 little-endian) captured in the
browser via the Web Audio API, so no external transcoder (ffmpeg) is required.
"""
from __future__ import annotations

import json
import os
import shutil
import struct
import subprocess
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
VOICE_DIR = ROOT / "voice_models"
CONFIG_FILE = DATA / "voice.json"

DEFAULT_CONFIG = {
    "enabled": True,
    "stt_backend": "vosk",          # vosk | auto
    "tts_backend": "espeak",        # espeak | piper | auto
    "language": "en-us",
    "speech_rate": 165,
    "voice_pitch": 50,
    "wake_word": "alice",
    "wake_word_enabled": False,
    "assistant_mode": "ethical-hacking-assistant",
    "auto_speak_responses": True,
    "input_device": "default",
}

# Candidate offline Vosk model locations (first existing wins).
MODEL_CANDIDATES = [
    VOICE_DIR / "vosk-model-small-en-us-0.15",
    VOICE_DIR / "vosk-model-en-us-0.22",
    Path("/usr/share/vosk/vosk-model-small-en-us-0.15"),
    Path("/opt/vosk/vosk-model-small-en-us-0.15"),
    Path(os.environ.get("VOSK_MODEL_PATH", "")) if os.environ.get("VOSK_MODEL_PATH") else None,
]


def _read_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2), encoding="utf-8")


class VoiceEngine:
    """Singleton-style offline voice engine."""

    def __init__(self):
        self._lock = threading.Lock()
        self._model = None
        self._model_path = None
        self._vosk_import_error = None
        self._tts_proc = None
        self._last_error = None
        self._init_stt()

    # ---------------------------------------------------------------- config
    def config(self):
        cfg = dict(DEFAULT_CONFIG)
        cfg.update(_read_json(CONFIG_FILE, {}) or {})
        return cfg

    def save_config(self, incoming):
        cfg = self.config()
        if isinstance(incoming, dict):
            for k in DEFAULT_CONFIG:
                if k in incoming:
                    cfg[k] = incoming[k]
        cfg["enabled"] = bool(cfg["enabled"])
        cfg["wake_word_enabled"] = bool(cfg["wake_word_enabled"])
        cfg["auto_speak_responses"] = bool(cfg["auto_speak_responses"])
        try:
            cfg["speech_rate"] = max(80, min(320, int(cfg["speech_rate"])))
        except Exception:
            cfg["speech_rate"] = DEFAULT_CONFIG["speech_rate"]
        try:
            cfg["voice_pitch"] = max(0, min(99, int(cfg["voice_pitch"])))
        except Exception:
            cfg["voice_pitch"] = DEFAULT_CONFIG["voice_pitch"]
        _write_json(CONFIG_FILE, cfg)
        return cfg

    # ------------------------------------------------------------------- STT
    def _find_model_path(self):
        for cand in MODEL_CANDIDATES:
            if cand and Path(cand).is_dir():
                return Path(cand)
        return None

    def _init_stt(self):
        try:
            import vosk  # noqa: F401
        except Exception as exc:  # vosk not installed
            self._vosk_import_error = str(exc)
            return
        path = self._find_model_path()
        if not path:
            self._last_error = "No offline Vosk model found."
            return
        try:
            from vosk import Model
            self._model = Model(str(path))
            self._model_path = str(path)
        except Exception as exc:
            self._last_error = f"Vosk model load failed: {exc}"

    def stt_available(self):
        return self._model is not None

    def transcribe_pcm(self, pcm_bytes, sample_rate=16000):
        """Transcribe raw Int16 mono PCM bytes with Vosk."""
        if not self._model:
            return {"ok": False, "error": self._last_error or "Offline speech model unavailable.", "text": ""}
        try:
            from vosk import KaldiRecognizer
            rec = KaldiRecognizer(self._model, int(sample_rate))
            rec.SetWords(True)
            # Feed in chunks; Vosk expects Int16 little-endian PCM.
            step = 4000 * 2
            for i in range(0, len(pcm_bytes), step):
                rec.AcceptWaveform(pcm_bytes[i:i + step])
            result = json.loads(rec.FinalResult())
            text = (result.get("text") or "").strip()
            words = result.get("result", [])
            return {"ok": True, "text": text, "words": words}
        except Exception as exc:
            return {"ok": False, "error": str(exc), "text": ""}

    def transcribe_wav(self, wav_path):
        """Transcribe a 16 kHz mono WAV file (fallback path)."""
        if not self._model:
            return {"ok": False, "error": self._last_error or "Offline speech model unavailable.", "text": ""}
        try:
            import wave
            from vosk import KaldiRecognizer
            with wave.open(str(wav_path), "rb") as wf:
                rec = KaldiRecognizer(self._model, wf.getframerate())
                rec.SetWords(True)
                while True:
                    data = wf.readframes(4000)
                    if not data:
                        break
                    rec.AcceptWaveform(data)
                result = json.loads(rec.FinalResult())
            return {"ok": True, "text": (result.get("text") or "").strip(), "words": result.get("result", [])}
        except Exception as exc:
            return {"ok": False, "error": str(exc), "text": ""}

    # ------------------------------------------------------------------- TTS
    def _espeak_binary(self):
        return shutil.which("espeak-ng") or shutil.which("espeak")

    def tts_available(self):
        return bool(self._espeak_binary()) or bool(shutil.which("piper"))

    def speak(self, text):
        """Speak text aloud through the local sound system (best effort)."""
        text = str(text or "").strip()
        if not text:
            return {"ok": False, "error": "Nothing to speak."}
        cfg = self.config()
        binary = self._espeak_binary()
        if binary:
            try:
                # Cancel any previous utterance.
                try:
                    subprocess.run(["pkill", "-f", "espeak"], capture_output=True, timeout=3)
                except Exception:
                    pass
                cmd = [binary, "-s", str(cfg["speech_rate"]), "-p", str(cfg["voice_pitch"]),
                       "-v", str(cfg["language"]), text[:600]]
                subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                return {"ok": True, "backend": "espeak"}
            except Exception as exc:
                return {"ok": False, "error": str(exc)}
        return {"ok": False, "error": "No offline text-to-speech engine (espeak-ng/piper) installed."}

    def synthesize_wav(self, text):
        """Render text to a WAV file for browser playback. Returns path or None."""
        text = str(text or "").strip()
        binary = self._espeak_binary()
        if not binary or not text:
            return None
        cfg = self.config()
        try:
            tmp = tempfile.NamedTemporaryFile(prefix="alice_tts_", suffix=".wav", delete=False)
            tmp.close()
            subprocess.run([binary, "-w", tmp.name, "-s", str(cfg["speech_rate"]),
                            "-p", str(cfg["voice_pitch"]), "-v", str(cfg["language"]),
                            text[:600]], capture_output=True, timeout=20)
            if Path(tmp.name).exists() and Path(tmp.name).stat().st_size > 44:
                return tmp.name
        except Exception:
            return None
        return None

    def stop_speaking(self):
        try:
            subprocess.run(["pkill", "-f", "espeak"], capture_output=True, timeout=3)
            return {"ok": True}
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    # ---------------------------------------------------------------- status
    def status(self):
        cfg = self.config()
        return {
            "ok": True,
            "enabled": cfg["enabled"],
            "stt": {
                "available": self.stt_available(),
                "backend": "vosk",
                "model": self._model_path or None,
                "error": self._last_error or self._vosk_import_error,
            },
            "tts": {
                "available": self.tts_available(),
                "backend": "espeak-ng" if self._espeak_binary() else ("piper" if shutil.which("piper") else None),
            },
            "language": cfg["language"],
            "wake_word": cfg["wake_word"],
            "wake_word_enabled": cfg["wake_word_enabled"],
            "assistant_mode": cfg["assistant_mode"],
            "offline": True,
        }


_engine = None
_engine_lock = threading.Lock()


def get_engine():
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = VoiceEngine()
    return _engine
