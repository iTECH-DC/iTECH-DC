# Alice OS 11.5 — Intelligence Core

## Architecture

- **FRIDAY** — local-first orchestration/persona layer.
- **GPT adapter** — optional OpenAI Responses API integration.
- **Claude adapter** — optional Anthropic Messages API integration.
- **Defensive Security AI** — local-only analysis of Alice OS security/audit results. It does not scan remote targets, exploit systems, or execute offensive actions.

## Privacy and network control

Network AI is OFF by default. Alice must have network access enabled **and** `network_ai_enabled` enabled before a cloud provider is called. API keys are read from `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`; they are not written to Alice's JSON settings.

## Model defaults

- GPT: `gpt-5.6-luna` (changeable in Intelligence Core).
- Claude: `claude-sonnet-5` (changeable in Intelligence Core).

## Security scope

The security adapter only evaluates local defensive audit data and localhost/Alice OS configuration. Any real security testing should remain within systems the owner is authorized to test.

## References

OpenAI documents current Responses API/model availability in its official API documentation. Anthropic documents its Messages API and current model lifecycle in its official platform documentation.
