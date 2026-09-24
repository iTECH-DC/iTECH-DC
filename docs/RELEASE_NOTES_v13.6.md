# Alice OS 13.6.0 — Online/Offline AI Parity + Ethical Security Workbench

Release date: 2025

## Highlights

Alice OS 13.6.0 delivers two headline capabilities that were the goal of this
release cycle:

1. **Run directly with AI when online, with full offline parity.** When a
   supported cloud provider is configured and the machine has a usable network,
   Alice answers *directly* through the cloud model. When there is no network,
   no key, or no provider enabled, Alice answers through the built-in **local
   brain** — a dependency-free reasoning engine — so the assistant is never a
   stub and never stops being useful.

2. **A cool, cyberpunk-styled Ethical Security Workbench.** The defensive
   security lab has been rebuilt as an animated console with category tabs,
   live tool-availability status, a scrolling scope marquee, an animated
   scanline, and a live output console with run-state indicators.

## Goal A — Direct AI when online + online/offline parity

### New local brain (`alice_core/intelligence/offline_brain.py`)
A dependency-free reasoning module that guarantees parity when offline:
- Curated knowledge base covering security, networking, OS, and computing concepts.
- Safe AST-based arithmetic evaluator (no `eval` of arbitrary code).
- Unit conversion (length, mass, temperature, data, time).
- Glossary lookups for "what is X" questions.
- Greetings, time/date, local-skill hints, and an honest fallback.

### Intelligent routing (`alice_core/intelligence/core.py`)
- New `auto_online_ai` setting (default **on**).
- `resolve_online()`, `effective_mode()`, and an enriched `provider_status()`.
- `ask()` now routes:
  - Online **and** a provider is ready → cloud model directly.
  - Otherwise → local brain (`offline_brain.think`).
- Security requests are always analyzed locally first (defensive-only), then
  optionally enriched by the defensive Security AI.

### Backend endpoints (`run_alice.py`)
- `/api/ai/parity` — returns the live mode (`online-ai` / `online-local` /
  `offline-local`), quality, and parity flag.
- `/api/ai/status` and `/api/ai/config` now surface network quality and mode.
- `/api/ai/query` and the local-intelligence path pass network quality and
  return the resolved mode.

### UI
- **AI Core parity banner** with a live status dot and mode-specific styling
  (green = running directly with AI, amber = online but no provider ready,
  blue = offline local-brain parity).
- New **"Auto-use AI when online"** toggle alongside the manual network toggle.
- Assistant footer shows the current parity mode.

## Goal B — Cool Ethical Security Workbench

The workbench is now a self-contained console UI:
- **Console chrome**: animated scanline, grid backdrop, shield glyph, and
  `AUTHORIZED` / `SCOPE · LOCALHOST` badges.
- **Scope marquee** reiterating the defensive-only, localhost-confined policy.
- **Category tabs** (recon, network, hardening, supply-chain, analysis,
  forensics, lab, password, web, malware, code) with per-category icons.
- **Tool grid** with hover glow, category tags, and one-click `RUN`.
- **Live status grid** showing local availability of each underlying tool.
- **Output console** with a live dot, run-state pill
  (`idle` / `running` / `done` / `error`), and a clear button.
- **Quick Audit** runs a chained defensive sweep
  (system inventory → config audit → local ports → secret scan).

All console actions are wired to the existing, unchanged endpoints:
`/api/security/tools`, `/api/security/tool`, `/api/security/tool-status`.

## Safety & scope (unchanged, reinforced)

The Ethical Security Workbench remains **defensive and owner-authorized only**:
- Localhost / workspace-confined operations only.
- No remote targeting, credential theft, persistence, evasion, or exploitation.
- Cloud API keys are read only from environment variables and are never stored
  in configuration.

## Compatibility

- No breaking changes to existing endpoints or data formats.
- Offline mode remains the default posture; network features stay opt-in.
- Existing settings files are upgraded in place (`auto_online_ai` defaults on).
