/* ============================================================================
 * Alice OS 14.0 — Security Workbench (client)
 * Owner-authorized, defensive-only. Network probes are localhost-only.
 * ========================================================================== */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function jget(url) {
    const r = await fetch(url);
    return r.json();
  }
  async function jpost(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    return r.json();
  }

  const SecurityUI = {
    open() {
      const p = $("aliceSecurityPanel");
      if (p) { p.classList.remove("hidden"); this.loadTools(); this.loadAudit(); }
    },
    close() { const p = $("aliceSecurityPanel"); if (p) p.classList.add("hidden"); },

    async loadTools() {
      const box = $("secToolGrid"); if (!box) return;
      box.innerHTML = "Loading tools…";
      try {
        const d = await jget("/api/security/tools");
        box.innerHTML = (d.tools || []).map((t) =>
          `<button class="sec-tool" title="${esc(t.description)}" onclick="AliceSecurityUI.run('${esc(t.id)}')">
             <b>${esc(t.name)}</b><small>${esc(t.category)}</small></button>`).join("");
      } catch (e) { box.innerHTML = "Could not load tools."; }
      this.loadStatus();
    },

    async loadStatus() {
      const box = $("secStatus"); if (!box) return;
      try {
        const d = await jget("/api/security/tool-status");
        const tools = d.tools || [];
        const installed = tools.filter((t) => t.installed).length;
        box.textContent = `${installed}/${tools.length} local tools installed • localhost-only scope`;
      } catch (e) { box.textContent = "Status unavailable."; }
    },

    async run(id) {
      const out = $("secOutput"); if (!out) return;
      out.textContent = "Running authorized defensive check…";
      try {
        const d = await jpost("/api/security/tool", { tool: id, args: {} });
        const res = d.result || {};
        let text = res.output || res.error || JSON.stringify(res, null, 2);
        if (res.tools) text = res.tools.map((t) => `${t.installed ? "✔" : "✘"}  ${t.name} — ${t.status}`).join("\n");
        if (res.checks) text = res.checks.map((c) => `${c.status}  ${c.name} — ${c.detail || ""}`).join("\n");
        out.textContent = text;
        this.loadAudit();
      } catch (e) { out.textContent = "Tool failed: " + e.message; }
    },

    async loadAudit() {
      const box = $("secAudit"); if (!box) return;
      try {
        const d = await jget("/api/security/audit-log");
        const items = d.items || [];
        if (!items.length) { box.innerHTML = '<div class="sec-audit-row muted">No security events yet.</div>'; return; }
        box.innerHTML = items.map((e) => {
          const t = new Date((e.time || 0) * 1000).toLocaleTimeString();
          const tag = e.refused ? '<span class="sec-tag refused">REFUSED</span>' : `<span class="sec-tag ok">${esc(e.intent || "ok")}</span>`;
          return `<div class="sec-audit-row">${tag}<span class="sec-audit-time">${t}</span><span class="sec-audit-text">${esc(e.text)}</span></div>`;
        }).join("");
      } catch (e) { box.innerHTML = '<div class="sec-audit-row muted">Audit log unavailable.</div>'; }
    },
  };

  window.AliceSecurityUI = SecurityUI;
  window.loadSecurityAuditLog = () => SecurityUI.loadAudit();
})();
