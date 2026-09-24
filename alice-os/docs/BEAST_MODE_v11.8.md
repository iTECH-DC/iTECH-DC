# Alice OS 11.8 — Beast Mode Integration

## Desktop target
The supplied 3:4 reference is stored as `docs/UI_REFERENCE_3x4.png`. It is a visual reference, not a claim that the reference screenshot is a live Alice OS runtime.

## Intelligence
- FRIDAY is the local orchestration layer.
- GPT and Claude are optional cloud providers and remain disabled unless the owner enables Network AI.
- Security AI performs defensive analysis of local Alice OS audit data. It does not scan remote systems or execute offensive actions.
- API keys are environment variables only; they are never written to JSON configuration.
- Conversation history must not store API keys or passwords.

## Boot
- Native PID 1 is now a self-contained C executable in the initramfs.
- Boot staging uses the current `VERSION` dynamically.
- ISO output name uses the current version dynamically.
- QEMU is only considered passed when an actual QEMU process exits successfully; otherwise validation reports the missing tool.
