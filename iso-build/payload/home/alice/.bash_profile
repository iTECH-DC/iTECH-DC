# Alice OS 14.0 — auto-start the graphical kiosk session on tty1.
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec startx /usr/bin/openbox-session -- :0 vt1 -keeptty
fi
