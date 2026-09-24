/* ============================================================================
 * Alice OS 14.0 — Offline Voice Assistant (client)
 * ----------------------------------------------------------------------------
 * 100% local speech pipeline:
 *   mic  ->  Web Audio (PCM 16 kHz mono)  ->  POST /api/voice/transcribe (Vosk)
 *        ->  POST /api/assistant/query    ->  POST /api/voice/tts (espeak) -> play
 *
 * Nothing is sent to any cloud service. The audio never leaves this machine.
 * ========================================================================== */
(function () {
  "use strict";

  const ALICE_VOICE = {
    listening: false,
    busy: false,
    continuous: false,
    wakeWord: "alice",
    wakeEnabled: false,
    sampleRate: 16000,
    stream: null,
    ctx: null,
    source: null,
    processor: null,
    analyser: null,
    chunks: [],
    recStart: 0,
    autoStopTimer: null,
    silenceTimer: null,
    maxMs: 12000,
    silenceMs: 1300,
    audioEl: null,
  };

  const $ = (id) => document.getElementById(id);

  /* ------------------------------------------------------------------ panel */
  function ensurePanel() {
    if ($("aliceVoicePanel")) return;
    const panel = document.createElement("section");
    panel.id = "aliceVoicePanel";
    panel.className = "side-panel glass-panel voice-panel hidden";
    panel.setAttribute("aria-label", "Alice Voice Assistant");
    panel.innerHTML = `
      <div class="panel-head">
        <div><h3>Alice Voice</h3><small class="muted">Offline • Vosk + espeak</small></div>
        <button onclick="AliceVoiceUI.close()" aria-label="Close">&times;</button>
      </div>
      <div class="voice-stage">
        <canvas id="aliceVoiceCanvas" class="voice-canvas" width="640" height="150"></canvas>
        <div class="voice-orb-wrap">
          <div id="aliceVoicePanelOrb" class="voice-orb" data-state="ready">
            <span class="voice-orb-core"></span>
            <span class="voice-orb-wave w1"></span>
            <span class="voice-orb-wave w2"></span>
          </div>
        </div>
        <div id="aliceVoicePanelState" class="voice-state">READY</div>
      </div>
      <div class="voice-controls">
        <button id="aliceVoicePTT" class="voice-btn primary" onclick="AliceVoiceUI.toggle()">
          <span class="mic-glyph">●</span> <span id="aliceVoicePTTLabel">Hold a conversation</span>
        </button>
        <button class="voice-btn" onclick="AliceVoiceUI.toggleContinuous()" id="aliceVoiceContBtn">Continuous: OFF</button>
        <button class="voice-btn" onclick="AliceVoiceUI.toggleWake()" id="aliceVoiceWakeBtn">Wake word: OFF</button>
        <button class="voice-btn" onclick="AliceVoiceUI.stopSpeaking()">Stop voice</button>
      </div>
      <div class="voice-transcript" id="aliceVoiceTranscript" aria-live="polite">
        <div class="voice-line system"><b>Alice</b><span>Voice assistant ready. Press the button and speak.</span></div>
      </div>
      <form class="voice-type-row" onsubmit="return AliceVoiceUI.submitTyped(event)">
        <input id="aliceVoiceTypeInput" autocomplete="off" placeholder="…or type to the assistant">
        <button class="primary-btn" type="submit">Send</button>
      </form>
      <div class="voice-settings">
        <label>Speech rate <input id="aliceVoiceRate" type="range" min="90" max="300" value="165" oninput="AliceVoiceUI.setRate(this.value)"></label>
        <label>Wake word <input id="aliceVoiceWakeWord" value="alice" onchange="AliceVoiceUI.setWakeWord(this.value)"></label>
        <span class="voice-foot">Local-only • 127.0.0.1</span>
      </div>`;
    document.body.appendChild(panel);
    drawIdleCanvas();
  }

  /* --------------------------------------------------------------- canvas */
  let canvasRAF = null;
  function canvas() { return $("aliceVoiceCanvas"); }

  function drawIdleCanvas() {
    const c = canvas(); if (!c) return;
    const g = c.getContext("2d");
    g.clearRect(0, 0, c.width, c.height);
    g.strokeStyle = "rgba(90,170,255,0.35)";
    g.lineWidth = 2;
    g.beginPath();
    for (let x = 0; x <= c.width; x += 4) {
      const y = c.height / 2 + Math.sin(x / 40) * 6;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }

  function startVisualizer() {
    const c = canvas(); if (!c || !ALICE_VOICE.analyser) return;
    const g = c.getContext("2d");
    const buf = new Uint8Array(ALICE_VOICE.analyser.frequencyBinCount);
    const draw = () => {
      if (!ALICE_VOICE.listening) { cancelAnimationFrame(canvasRAF); drawIdleCanvas(); return; }
      ALICE_VOICE.analyser.getByteTimeDomainData(buf);
      g.clearRect(0, 0, c.width, c.height);
      // gradient wave
      const grad = g.createLinearGradient(0, 0, c.width, 0);
      grad.addColorStop(0, "#2b6cff");
      grad.addColorStop(0.5, "#37e6ff");
      grad.addColorStop(1, "#7c5cff");
      g.strokeStyle = grad;
      g.lineWidth = 3;
      g.beginPath();
      const slice = c.width / buf.length;
      let x = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        const y = c.height / 2 + v * (c.height / 2.4);
        i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        x += slice;
      }
      g.stroke();
      canvasRAF = requestAnimationFrame(draw);
    };
    draw();
  }

  /* ---------------------------------------------------------------- state */
  function setState(state, label) {
    const orb = $("aliceVoicePanelOrb");
    const st = $("aliceVoicePanelState");
    const topOrb = $("aliceVoiceOrb");
    const topLabel = $("aliceVoiceState");
    if (orb) orb.dataset.state = state;
    if (st) st.textContent = label || state.toUpperCase();
    if (topOrb) topOrb.dataset.state = state;
    if (topLabel) topLabel.textContent = label || state.toUpperCase();
  }

  function line(who, text, cls) {
    const box = $("aliceVoiceTranscript"); if (!box) return;
    const d = document.createElement("div");
    d.className = "voice-line " + (cls || (who === "Alice" ? "system" : "user"));
    d.innerHTML = `<b>${who}</b><span></span>`;
    d.querySelector("span").textContent = text;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    while (box.children.length > 60) box.removeChild(box.firstChild);
  }

  /* -------------------------------------------------------------- capture */
  async function startListening() {
    if (ALICE_VOICE.listening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      ALICE_VOICE.stream = stream;
      let ctx;
      try { ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 }); }
      catch (_) { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      ALICE_VOICE.ctx = ctx;
      ALICE_VOICE.sampleRate = ctx.sampleRate;
      const source = ctx.createMediaStreamSource(stream);
      ALICE_VOICE.source = source;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ALICE_VOICE.analyser = analyser;
      source.connect(analyser);
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      ALICE_VOICE.processor = proc;
      ALICE_VOICE.chunks = [];
      proc.onaudioprocess = (e) => {
        if (!ALICE_VOICE.listening) return;
        const input = e.inputBuffer.getChannelData(0);
        // simple energy-based silence detection
        let energy = 0;
        for (let i = 0; i < input.length; i += 8) energy += Math.abs(input[i]);
        energy /= (input.length / 8);
        ALICE_VOICE.chunks.push(new Float32Array(input));
        if (energy > 0.012) {
          clearTimeout(ALICE_VOICE.silenceTimer);
          ALICE_VOICE.silenceTimer = setTimeout(() => {
            if (ALICE_VOICE.listening && !ALICE_VOICE.continuous) finishListening();
          }, ALICE_VOICE.silenceMs);
        }
      };
      source.connect(proc);
      proc.connect(ctx.destination);
      ALICE_VOICE.listening = true;
      ALICE_VOICE.recStart = Date.now();
      setState("listening", "LISTENING");
      startVisualizer();
      clearTimeout(ALICE_VOICE.autoStopTimer);
      ALICE_VOICE.autoStopTimer = setTimeout(() => { if (!ALICE_VOICE.continuous) finishListening(); }, ALICE_VOICE.maxMs);
    } catch (err) {
      line("Alice", "Microphone unavailable: " + (err && err.message ? err.message : err), "error");
      setState("ready", "READY");
    }
  }

  function stopTracks() {
    try { ALICE_VOICE.processor && ALICE_VOICE.processor.disconnect(); } catch (_) {}
    try { ALICE_VOICE.source && ALICE_VOICE.source.disconnect(); } catch (_) {}
    try { ALICE_VOICE.ctx && ALICE_VOICE.ctx.close(); } catch (_) {}
    try { ALICE_VOICE.stream && ALICE_VOICE.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
    ALICE_VOICE.processor = null; ALICE_VOICE.source = null; ALICE_VOICE.ctx = null; ALICE_VOICE.stream = null;
    cancelAnimationFrame(canvasRAF);
  }

  function flattenChunks() {
    let total = 0;
    for (const c of ALICE_VOICE.chunks) total += c.length;
    const out = new Float32Array(total);
    let off = 0;
    for (const c of ALICE_VOICE.chunks) { out.set(c, off); off += c.length; }
    return out;
  }

  function downsample(float32, inRate, outRate) {
    if (outRate === inRate) return float32;
    const ratio = inRate / outRate;
    const len = Math.round(float32.length / ratio);
    const out = new Float32Array(len);
    let pos = 0, idx = 0;
    while (idx < len) {
      const next = Math.round((idx + 1) * ratio);
      let sum = 0, cnt = 0;
      for (let i = pos; i < next && i < float32.length; i++) { sum += float32[i]; cnt++; }
      out[idx] = cnt ? sum / cnt : 0;
      idx++; pos = next;
    }
    return out;
  }

  function toInt16PCM(float32) {
    const buf = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < float32.length; i++) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buf;
  }

  async function finishListening() {
    if (!ALICE_VOICE.listening) return;
    clearTimeout(ALICE_VOICE.autoStopTimer);
    clearTimeout(ALICE_VOICE.silenceTimer);
    ALICE_VOICE.listening = false;
    const raw = flattenChunks();
    const inRate = ALICE_VOICE.sampleRate || 16000;
    stopTracks();
    setState("thinking", "TRANSCRIBING");
    if (raw.length < inRate * 0.25) {
      line("Alice", "That was too short — try again.", "system");
      setState("ready", "READY");
      if (ALICE_VOICE.continuous) scheduleContinuous();
      return;
    }
    const pcm = toInt16PCM(downsample(raw, inRate, 16000));
    try {
      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "X-Sample-Rate": "16000" },
        body: pcm,
      });
      const data = await res.json();
      if (!data.ok) {
        line("Alice", data.error || "Transcription failed.", "error");
        setState("ready", "READY");
        if (ALICE_VOICE.continuous) scheduleContinuous();
        return;
      }
      const text = (data.text || "").trim();
      if (!text) {
        line("Alice", "(no speech detected)", "system");
        setState("ready", "READY");
        if (ALICE_VOICE.continuous) scheduleContinuous();
        return;
      }
      line("You", text, "user");
      // wake-word gate for continuous mode
      if (ALICE_VOICE.continuous && ALICE_VOICE.wakeEnabled) {
        const low = text.toLowerCase();
        if (!low.includes(ALICE_VOICE.wakeWord)) {
          setState("ready", "READY");
          scheduleContinuous();
          return;
        }
      }
      await askAssistant(text);
    } catch (err) {
      line("Alice", "Voice backend error: " + (err && err.message ? err.message : err), "error");
      setState("ready", "READY");
    }
    if (ALICE_VOICE.continuous) scheduleContinuous();
  }

  function scheduleContinuous() {
    if (!ALICE_VOICE.continuous) return;
    setTimeout(() => { if (ALICE_VOICE.continuous && !ALICE_VOICE.listening) startListening(); }, 350);
  }

  /* ------------------------------------------------------------- assistant */
  async function askAssistant(text) {
    setState("thinking", "THINKING");
    try {
      const res = await fetch("/api/assistant/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      const speech = data.speech || data.answer || "…";
      line("Alice", speech, data.intent === "refused" ? "refused" : "system");
      if (data.intent === "security" && data.data) {
        renderSecurity(data);
      }
      await speak(speech);
    } catch (err) {
      line("Alice", "Assistant error: " + (err && err.message ? err.message : err), "error");
    }
    setState("ready", "READY");
  }

  function renderSecurity(data) {
    const box = $("aliceVoiceTranscript"); if (!box) return;
    const d = document.createElement("div");
    d.className = "voice-line security";
    const pre = document.createElement("pre");
    pre.className = "voice-sec-output";
    const payload = data.data || {};
    let text = "";
    if (payload.output) text = payload.output;
    else if (payload.tools) text = payload.tools.map((t) => `${t.installed ? "✔" : "✘"} ${t.name}`).join("\n");
    else if (payload.checks) text = payload.checks.map((c) => `${c.status} — ${c.name}`).join("\n");
    else text = JSON.stringify(payload, null, 2);
    pre.textContent = text.slice(0, 4000);
    d.innerHTML = `<b>Workbench</b>`;
    d.appendChild(pre);
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }

  /* ------------------------------------------------------------------- TTS */
  async function speak(text) {
    if (!text) return;
    try {
      setState("speaking", "SPEAKING");
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: String(text).slice(0, 600) }),
      });
      if (!res.ok) { setState("ready", "READY"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (!ALICE_VOICE.audioEl) ALICE_VOICE.audioEl = new Audio();
      ALICE_VOICE.audioEl.src = url;
      await ALICE_VOICE.audioEl.play().catch(() => {});
      await new Promise((resolve) => {
        ALICE_VOICE.audioEl.onended = resolve;
        setTimeout(resolve, 15000);
      });
      URL.revokeObjectURL(url);
    } catch (_) {}
    setState("ready", "READY");
  }

  /* --------------------------------------------------------------- public */
  const AliceVoiceUI = {
    open() {
      ensurePanel();
      const p = $("aliceVoicePanel");
      if (p) p.classList.remove("hidden");
      this.refreshStatus();
    },
    close() {
      if (ALICE_VOICE.listening) this.stop();
      const p = $("aliceVoicePanel");
      if (p) p.classList.add("hidden");
    },
    toggle() {
      if (ALICE_VOICE.listening) this.stop();
      else startListening();
    },
    stop() {
      ALICE_VOICE.continuous = false;
      updateContinuousBtn();
      if (ALICE_VOICE.listening) finishListening();
      else { stopTracks(); setState("ready", "READY"); }
    },
    toggleContinuous() {
      ALICE_VOICE.continuous = !ALICE_VOICE.continuous;
      updateContinuousBtn();
      if (ALICE_VOICE.continuous && !ALICE_VOICE.listening) startListening();
      if (!ALICE_VOICE.continuous && ALICE_VOICE.listening) finishListening();
    },
    toggleWake() {
      ALICE_VOICE.wakeEnabled = !ALICE_VOICE.wakeEnabled;
      updateWakeBtn();
    },
    setWakeWord(v) { ALICE_VOICE.wakeWord = (v || "alice").toLowerCase().trim() || "alice"; },
    setRate(v) {
      fetch("/api/voice/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ speech_rate: parseInt(v, 10) }) }).catch(() => {});
    },
    stopSpeaking() {
      try { ALICE_VOICE.audioEl && ALICE_VOICE.audioEl.pause(); } catch (_) {}
      fetch("/api/voice/stop", { method: "POST" }).catch(() => {});
      setState("ready", "READY");
    },
    async submitTyped(ev) {
      ev.preventDefault();
      const i = $("aliceVoiceTypeInput");
      const text = (i && i.value || "").trim();
      if (!text) return false;
      line("You", text, "user");
      i.value = "";
      await askAssistant(text);
      return false;
    },
    async refreshStatus() {
      try {
        const res = await fetch("/api/voice/status");
        const s = await res.json();
        const stt = s.stt && s.stt.available ? "STT ready" : "STT unavailable";
        const tts = s.tts && s.tts.available ? "TTS ready" : "TTS unavailable";
        const st = $("aliceVoicePanelState");
        if (st && !ALICE_VOICE.listening) st.textContent = `${stt} • ${tts}`;
      } catch (_) {}
    },
  };

  function updateContinuousBtn() {
    const b = $("aliceVoiceContBtn");
    if (b) b.textContent = "Continuous: " + (ALICE_VOICE.continuous ? "ON" : "OFF");
  }
  function updateWakeBtn() {
    const b = $("aliceVoiceWakeBtn");
    if (b) b.textContent = "Wake word: " + (ALICE_VOICE.wakeEnabled ? "ON" : "OFF");
  }

  window.AliceVoiceUI = AliceVoiceUI;

  // Route the legacy voice triggers (top orb, assistant card mic) to the new
  // fully-offline voice panel instead of the browser cloud speech API.
  function bindLegacyTriggers() {
    window.toggleAliceVoice = function () { AliceVoiceUI.open(); AliceVoiceUI.toggle(); };
    window.openAliceVoice = function () { AliceVoiceUI.open(); };
    window.startAliceVoice = function () { AliceVoiceUI.open(); if (!ALICE_VOICE.listening) startListening(); };
    window.stopAliceVoice = function () { AliceVoiceUI.stop(); };
  }

  window.addEventListener("DOMContentLoaded", () => {
    ensurePanel(); updateContinuousBtn(); updateWakeBtn(); bindLegacyTriggers();
  });
  if (document.readyState === "interactive" || document.readyState === "complete") {
    ensurePanel(); updateContinuousBtn(); updateWakeBtn(); bindLegacyTriggers();
  }
})();
