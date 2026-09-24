# Alice OS 12.5 — Keyboard Shortcuts

Alice OS 12.5 adds a Windows-style desktop shortcut layer. Shortcuts are handled by the Alice desktop when it has keyboard focus; the underlying host OS retains control of shortcuts that browsers/applications cannot safely intercept.

## Windows-style shortcuts
- Win / Ctrl+Esc — Start
- Win+D — show/restore desktop
- Win+E — Files & Data
- Win+I — Settings
- Win+A — Quick Settings
- Win+N — Notifications
- Win+S — Start search
- Win+R — Alice Run dialog
- Win+X — System Control Center
- Win+L — lock Alice
- Win+Tab / Alt+Tab — window switching
- Win+Left/Right — snap active window
- Win+Up/Down — maximize/minimize
- Win+M — minimize all
- Win+Shift+M — restore all
- Win+Home — minimize all except active
- Win+C — Alice Assistant
- Win+K — Connectivity Center
- Win+U — Accessibility settings
- Win+P — System Control Center
- Win+W — Alice System Dashboard
- Win+Z — active-window menu
- Win+1…9 — activate taskbar entries

## Window/application shortcuts
- Alt+F4 — close active Alice window
- Alt+Space — window menu
- Ctrl+W — close active Alice window
- Ctrl+Tab / Ctrl+Shift+Tab — next/previous Alice window
- Ctrl+Shift+T — reopen last closed Alice window
- Ctrl+Shift+Esc — Task Manager
- Ctrl+Shift+N — new folder in Files (when Files is active)
- F1 — shortcut reference
- F5 — refresh local system information
- Ctrl+K — Start search
- Ctrl+L — terminal clear/focus search
- Esc — close transient panels/dialogs

## Deliberate host-reserved shortcuts
Some Windows shortcuts are not intercepted because Alice is currently a desktop/web runtime rather than the host kernel/compositor. Examples include Ctrl+Alt+Delete, Print Screen, native virtual-desktop switching, and system-level clipboard history. These remain under the host OS.
