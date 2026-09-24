# Alice OS 13.2 — Location Map

Alice's Location Map is a permission-based local map indicator.

## Supported
- Current-device location through the host/browser geolocation permission.
- Trusted-contact locations only when the person has explicitly shared the coordinates.
- Local storage of shared locations in `data/locations.json`.
- Offline map visualization using a local grid; no third-party map service is required.
- Manual removal of shared contacts.

## Privacy boundary
Alice does **not** infer or secretly reveal a person's physical location from an IP address. IP geolocation is approximate and cannot replace consent-based location sharing. There is no covert tracking, background stalking, or hidden device-location lookup.

## Future networked design
A future multi-device implementation can accept signed, consent-based location updates from Alice companion devices. Such updates should be owner-controlled, revocable, authenticated, and visible to the person sharing the location.
