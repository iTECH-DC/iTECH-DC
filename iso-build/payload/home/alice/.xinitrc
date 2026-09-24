#!/bin/sh
# Alice OS 14.0 kiosk session — X + Openbox + Chromium kiosk on the local assistant.
export XDG_RUNTIME_DIR=/run/user/1000

# Disable screen blanking / DPMS for a kiosk appliance.
xset s off
xset -dpms
xset s noblank

# Local cursor + keymap niceties.
xsetroot -solid "#0a1020" 2>/dev/null

# Wait for the Alice server to answer on loopback (up to ~30s).
i=0
while [ $i -lt 60 ]; do
  if curl -s -o /dev/null http://127.0.0.1:8765/api/voice/status; then break; fi
  i=$((i+1)); sleep 0.5
done

# Launch the desktop window manager.
openbox-session &
sleep 1

# Launch the Alice OS UI full-screen (kiosk). Web Audio + getUserMedia are used
# for the fully-offline voice assistant.
exec chromium \
  --kiosk \
  --no-first-run \
  --no-default-browser-check \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-translate \
  --disable-features=TranslateUI \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  --enable-features=WebRTCPipeWireCapturer \
  --check-for-update-interval=31536000 \
  http://127.0.0.1:8765/
