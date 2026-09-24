#!/usr/bin/env bash
# Fetch the offline Vosk speech-to-text model used by Alice OS 14.0.
# The model is NOT stored in git (it is ~40 MB of binary data).
# Run this once before building the ISO or running the voice assistant locally.
set -euo pipefail

MODEL="vosk-model-small-en-us-0.15"
URL="https://alphacephei.com/vosk/models/${MODEL}.zip"
DEST="${1:-alice-os/voice_models}"

mkdir -p "$DEST"
cd "$DEST"

if [ -d "$MODEL" ]; then
  echo "Model already present at $DEST/$MODEL"
  exit 0
fi

echo "Downloading $MODEL ..."
if command -v curl >/dev/null 2>&1; then
  curl -L -o "${MODEL}.zip" "$URL"
elif command -v wget >/dev/null 2>&1; then
  wget -O "${MODEL}.zip" "$URL"
else
  echo "ERROR: need curl or wget to download the model" >&2
  exit 1
fi

echo "Extracting ..."
unzip -q "${MODEL}.zip"
rm -f "${MODEL}.zip"

echo "Done. Offline STT model ready at $DEST/$MODEL"
