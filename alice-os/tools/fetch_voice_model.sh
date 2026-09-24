#!/bin/bash
# Download the offline Vosk English model into voice_models/.
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)/voice_models"
mkdir -p "$DIR"; cd "$DIR"
URL="https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
echo "Downloading $URL"
curl -L -o model.zip "$URL"
unzip -q -o model.zip && rm -f model.zip
echo "Model ready in $DIR"
