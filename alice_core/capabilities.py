"""Alice OS online/offline capability manager.

The desktop remains the same in both modes. Network-dependent capabilities are
explicitly gated so losing Internet never breaks local OS features.
"""
from __future__ import annotations

from typing import Dict, Iterable

NETWORK_DEPENDENT = {
    "alice_internet",
    "cloud_sync",
    "online_ai",
    "online_updates",
    "remote_services",
}

LOCAL_CAPABILITIES = {
    "desktop",
    "files",
    "terminal",
    "settings",
    "security_lab",
    "assistant_local",
    "memories",
    "schedules",
    "system_monitor",
    "device_manager",
    "bluetooth",
    "wifi_controls",
    "calculator",
    "notepad",
    "paint",
    "camera",
    "media_player",
}


def _internet_available(network_status: dict) -> bool:
    if not bool(network_status.get("enabled")):
        return False
    return network_status.get("quality") in {"online", "moderate"} and bool(network_status.get("interface_connected"))


def snapshot(network_status: dict) -> Dict:
    """Return a stable capability contract for the desktop and applications."""
    internet = _internet_available(network_status or {})
    online = bool(network_status.get("enabled")) and internet
    capabilities = {name: True for name in LOCAL_CAPABILITIES}
    for name in NETWORK_DEPENDENT:
        capabilities[name] = internet

    return {
        "mode": "online" if online else "offline",
        "internet_available": internet,
        "network_permission": bool(network_status.get("enabled")),
        "quality": network_status.get("quality", "offline"),
        "capabilities": capabilities,
        "online_only": sorted(NETWORK_DEPENDENT),
        "offline_core": sorted(LOCAL_CAPABILITIES),
        "policy": "Same Alice OS desktop in both modes; only genuinely network-dependent capabilities are gated.",
    }


def allowed(name: str, network_status: dict) -> bool:
    if name in LOCAL_CAPABILITIES:
        return True
    if name in NETWORK_DEPENDENT:
        return _internet_available(network_status or {})
    return False
