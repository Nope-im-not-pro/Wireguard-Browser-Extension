# WireGuard Browser Extension

Routet ausschließlich Firefox-Traffic durch einen WireGuard-Tunnel, ohne
System-VPN und ohne Anbieter-Control-Plane. Umsetzung nach Weg A'
(userspace SOCKS5): eine Firefox-Extension steuert über Native-Messaging
einen lokalen Go-Host, der `wireproxy` (userspace WG) startet und lokal
einen SOCKS5-Proxy anbietet; `proxy.settings` zeigt nur Firefox dorthin.

## Abgrenzung

Reiner WireGuard-Client (Datenebene, manuelle Configs). Der Tailnet-Client
mit Tailscale-Control-Plane liegt in `TailScale-BrowserExtension/`.

## Architektur (3 Teile)

1. **Firefox WebExtension** (`extension/`, MV2): UI, Konfig-Verwaltung,
   `proxy.settings`, Status. Backend-unabhängiger Teil sofort nutzbar.
2. **Native-Messaging-Host** (`native-host/`, Go): startet/stoppt
   `wireproxy`, verwaltet Keys im OS-Keystore, meldet Status.
3. **wireproxy** (Binary): terminiert den WG-Tunnel userspace, bietet
   SOCKS5 lokal an.

Details: [ERKLAERUNG.md](ERKLAERUNG.md), [UMSETZUNGSPLAN.md](UMSETZUNGSPLAN.md),
[KONZEPT.md](KONZEPT.md).

## Status

Wellen 1-3 umgesetzt (v0.2.0). Extension-Unit-Tests grün (19/19). Go-Host
code-vollständig, Build/Tests lokal noch nicht ausgeführt (keine
Go-Toolchain). Smoke-/Leak-Check gegen echten Endpoint ausstehend
(wireproxy-Binary nicht gebündelt).

## Setup / Build

### Extension
- Laden (Entwicklung): `about:debugging` -> Dieses Firefox -> Temporäres
  Add-on laden -> `extension/manifest.json`.
- Paketieren: `web-ext build -s extension/` (AMO-Signatur für Dauerbetrieb,
  Plan 9.1).
- Unit-Tests: `cd extension && node --test`.

### Native-Host (Go)
- Build: `cd native-host && go build -o bin/host ./cmd/host` (Windows:
  `host.exe`).
- Tests: `cd native-host && go test ./...`.
- Registrieren: `dist/installers/install_windows.ps1` bzw.
  `install_unix.sh` (kopiert Host + wireproxy, legt Native-Messaging-
  Manifest an).

### wireproxy
- Gepinnte Version + Checksums: [dist/wireproxy/VERSIONS.md](dist/wireproxy/VERSIONS.md).
- Host findet das Binary über `WIREPROXY_BIN` (vom Installer gesetzt).

## Struktur

```
WireGuard-BrowserExtension/
|-- extension/        Firefox MV2 (models/ services/ controllers/ view/ background/ tests/)
|-- native-host/      Go-Host (cmd/host, internal/{protocol,broker,proc,keystore,config}, tests)
|-- dist/             installers/ + wireproxy/ (Pinning)
|-- z_INFOS/          Vorarbeit (nicht nach GitHub)
\-- *.md              Pflicht-Doku (README, CHANGELOG, INFRA, MVC, ERKLAERUNG,
                      PROCESS_STEPS) + KONZEPT, UMSETZUNGSPLAN
```

## Doku

- [MVC.md](MVC.md) - Schichten-Zuordnung.
- [ERKLAERUNG.md](ERKLAERUNG.md) - Architektur-/Design-Entscheidungen.
- [INFRA.md](INFRA.md) - Build/Deploy/Ports/Native-Messaging.
- [CHANGELOG.md](CHANGELOG.md) - Änderungshistorie.
