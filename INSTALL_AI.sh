#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
python3 -m pip install -r requirements-ai.txt || echo "Optional SDK installation failed; built-in stdlib adapters remain available."
cat <<'EOF'
Configure API keys as environment variables (never store keys in Alice files):
  export OPENAI_API_KEY="YOUR_KEY"
  export ANTHROPIC_API_KEY="YOUR_KEY"
Then start Alice and enable Network AI in Intelligence Core.
EOF
