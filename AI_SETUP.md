# Alice OS 12.0 — AI Setup

Alice is local-first. No API key is required for offline operation.

## Optional providers

Set environment variables on the development machine only:

- `OPENAI_API_KEY` — enables the optional OpenAI provider.
- `ANTHROPIC_API_KEY` — enables the optional Claude provider.

Alice never writes these values into `data/ai_core.json`.

## Recommended models

- GPT: `gpt-5.6-luna` for cost-sensitive/general workloads.
- GPT Security AI: `gpt-5.6-cyber` for authorized defensive security analysis.
- Claude: `claude-sonnet-5` for general reasoning/coding.

Network AI is disabled by default. The owner must enable both Alice Network Access and Network AI before any cloud request is attempted.

## Security boundary

The Security AI layer is defensive. It analyzes Alice's local configuration, audit checks, logs, and localhost lab results. It does not provide remote-target scanning, credential theft, persistence, evasion, or unauthorized-access workflows.
