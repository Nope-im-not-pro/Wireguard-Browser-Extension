# Changelog - WireGuard Browser Extension

Format: SemVer + ISO-Datum. Sektionen: Hinzugefuegt / Geaendert / Behoben / Entfernt / Verifiziert.

## [0.2.5] - 2026-07-16

### Geaendert
- `004_push_github.ps1`: Default-Remote gesetzt auf
  `https://github.com/Nope-im-not-pro/Wireguard-Browser-Extension.git`
  (vorher kein Default -> `-Remote` bei Erstlauf zwingend). `-Remote`
  ueberschreibt weiterhin und aktualisiert vorhandenes `origin`. Doku
  (.SYNOPSIS/.EXAMPLE/.PARAMETER) + [INFRA.md](INFRA.md) Abschnitt
  "GitHub-Push" synchronisiert.

### Verifiziert
- `[Parser]::ParseFile` fehlerfrei (PARSE OK). `git` im PATH vorhanden.
- Nicht verifiziert: realer Push (Auth/Remote-Repo = Nutzer-Aktion).

## [0.2.4] - 2026-07-16

### Hinzugefuegt
- `004_push_github.ps1`: idempotenter GitHub-Push (Repo-Init bei Bedarf,
  Remote-`origin`-Setup/Update, Commit getrackter Aenderungen, Push nach
  `main`). Kein Fremd-Repo-Default: Remote beim ersten Lauf via `-Remote`
  zwingend, danach wird `origin` wiederverwendet. Secret-Guard bricht ab, wenn
  trotz `.gitignore` `.env`/`*_token.json`/`_secrets/`/`dist/signed/` gestaged
  sind (nimmt Staging zurueck).

### Verifiziert
- `[Parser]::ParseFile` fehlerfrei (PARSE OK).
- Nicht verifiziert: realer Push (kein Remote-Repo/Auth im Rahmen dieser Session).

## [0.2.3] - 2026-07-16

PII-Leak-Haertung (FIXPLAN_PII.md, Befunde B1..B5). Prioritaet B1 > B4 > B3 > B2 > B5.

### Geaendert
- Extension-Manifest-Version `0.1.0` -> `0.1.1` ([extension/manifest.json](extension/manifest.json)).
  Neu-Signatur erforderlich (live-Version).
- B1 (Model): WebRTC-Default gehaertet - `settings.js defaults().webrtcDisabled`
  `false` -> `true`. Neu-Nutzer haben WebRTC per Default aus (kein STUN-IP-Leak
  trotz Tunnel); bei `killSwitch=false` weiter frei waehlbar. `webrtcEffective`
  unveraendert. Bestandsnutzer mit persistiertem `false` bleiben unveraendert
  (kein Zwangs-Override; `normalize` erzwingt das Feld nicht).

### Behoben (Sicherheit / PII-Leak)
- B2 (Config): `<all_urls>`-Permission aus `manifest.json` entfernt. Ungenutzt
  (keine content_scripts/webRequest; `proxy.settings` braucht kein Host-Permission).
  Angriffsflaeche reduziert.
- B3 (Service additiv + View): IPv6-Leak-Warnung bei Tunnel-Import/Anlage. Neue
  reine Funktion `validation.js fullTunnelGaps(allowedIPs)` (Praesenz `0.0.0.0/0`
  / `::/0`); Views `layer2-tunnel.js` und `layer3-manual.js` (Formular + Bulk)
  haengen nicht-blockierende Warnung an, wenn `::/0` in AllowedIPs fehlt (reale
  IPv6 kann sonst am Tunnel vorbei leaken). Warnung rein aus zurueckgegebenem
  Tunnel-Objekt, `textContent`, keine Key-Beruehrung.
- B4 (Native-Host): wireproxy-Tempfile gehaertet ([proc/wireproxy.go](native-host/internal/proc/wireproxy.go)).
  `O_CREATE|O_EXCL|O_WRONLY, 0600` statt `os.WriteFile` (kein Anhaengen an
  vorbestehende Datei / Symlink-Ueberschreiben); zufaelliges Namenssuffix
  (`wg-browser-<port>-<rand>.conf`, schliesst Symlink-Race-Fenster);
  Orphan-Cleanup beim Start (Klartext-Key nach Host-Crash/`kill -9` wird
  nachgeholt entfernt).
- B5 (Build): `tests/**` aus signiertem `.xpi` ausgeschlossen -
  `--ignore-files "tests/**"` in [003_sign.ps1](003_sign.ps1). `web-ext` liest
  keine `.web-ext-ignore`-Datei automatisch; `--ignore-files` ist der wirksame
  Mechanismus (Abweichung von FIXPLAN-Annahme).

### Verifiziert
- `node --test extension/tests/*.test.js`: 20/20 gruen (19 vorher + neuer
  `fullTunnelGaps`-Test; B1-Default-Assertion in bestehendem `defaults`-Test).
- `manifest.json` valides JSON, Version `0.1.1`, ohne `<all_urls>`.
- Grep: `<all_urls>` ohne Code-Nutzung (nur ehemaliger Manifest-Eintrag), kein
  `webRequest`/`tabs.` -> B2-Entfernung ohne Regress.

### Offen (nicht verifiziert)
- B4 Go-Test (`native-host/tests/wireproxy_test.go`, neu): Go-Toolchain lokal
  nicht installiert -> `go test ./...` nicht ausgefuehrt. Test kompiliert
  Dummy-Bin selbst (cross-platform), Ausfuehrung ausstehend.
- `web-ext lint` / `web-ext sign`: web-ext lokal nicht vorhanden -> Repack/Resign
  + Lint ausstehend (DoD Schritt 4/7).
- B4 Residual: `cleanupOrphans` entfernt alle `wg-browser-*.conf` im TempDir;
  unkritisch (Broker single-lock -> eine Instanz; wireproxy liest Conf nur beim
  Start).

## [0.2.2] - 2026-07-16

### Hinzugefuegt
- `003_sign.ps1`: AMO-Signatur der Extension via `web-ext sign`. Liest
  Credentials aus `.env` (`JWT_USER` -> `--api-key`/Issuer,
  `FIREFOX_API_KEY` -> `--api-secret`/Secret), Kanal `unlisted|listed`,
  Artefakte nach `dist/signed/`. Secrets werden nie ausgegeben.

### Behoben
- Sicherheit: `.gitignore` deckte `.env` nicht ab (§10-Verstoss). Eintraege
  `*.env`, `.env`, `_secrets/`, `*_token.json`, `dist/signed/` ergaenzt.

### Verifiziert
- `003_sign.ps1` parst fehlerfrei; `.env`-Parsing loest `JWT_USER` (len 17)
  + `FIREFOX_API_KEY` (len 64) auf (ohne Klartext-Ausgabe).
- Nicht verifiziert: realer `web-ext sign`-Lauf (kein web-ext lokal, keine
  Live-AMO-Submission).

## [0.2.1] - 2026-07-16

### Hinzugefuegt
- Root-Setup-Scripts (Windows): `000_install.ps1` (Go/Node-Check, Go via
  winget optional), `002_build.ps1` (`go test ./...` + `go build` ->
  `native-host/bin/host.exe`, CGO aus), `001_setup.ps1` (wireproxy-Bereitstellung
  inkl. optionalem SHA-256-verifiziertem Download, delegiert Installation +
  Manifest-Render + Registry an `dist/installers/install_windows.ps1`).
- `INSTALL.md`: Schritt-fuer-Schritt-Anleitung Windows (wireproxy + Native-Host
  + Native-Messaging-Manifest + Registry), Exit-Codes, Deinstallation.

### Behoben
- wireproxy-Pinning: `<PIN_SHA256>`-Platzhalter in
  `dist/wireproxy/VERSIONS.md` durch echte SHA-256 der Release v1.0.9 ersetzt
  (windows/darwin/linux amd64+arm64). Download in `001_setup.ps1` lief sonst
  auf Exit 2 (Placeholder-Guard).
- Falsches Asset-Format korrigiert: wireproxy-Releases sind `.tar.gz` (auch
  Windows), nicht `.zip`. `001_setup.ps1` entpackt via `tar` statt
  `Expand-Archive`; VERSIONS.md-Dateinamen angepasst.

### Verifiziert
- Alle drei Scripts parsen fehlerfrei (`[Parser]::ParseFile`).
- wireproxy-Download-Pfad end-to-end getestet: Fetch v1.0.9, SHA-256 match
  gegen Pin, `tar`-Extraktion liefert `wireproxy.exe` (8.69 MB).
- Nicht verifiziert: Go-Build/Test-Ausfuehrung (keine Go-Toolchain lokal).

## [0.2.0] - 2026-07-16

### Hinzugefuegt
- Firefox-WebExtension (MV2, `extension/`) umgesetzt (UMSETZUNGSPLAN.md Wellen 1-3):
  - Model: `tunnel.js`, `settings.js`, `storage.js` (Schema 3.1/3.2, `storage.local` CRUD).
  - Service: `conf-parser.js`, `validation.js` (F-04/F-06/F-07), `native-client.js`
    (Protokoll Plan 5), `proxy-control.js` (socks5h, OP-6 DNS L2), `privacy-control.js`
    (WebRTC OP-6 L4), `notifications.js` (F-11/F-12/F-17), `logger.js` (F-13).
  - Controller: `message-router.js`, `tunnel-controller.js`, `settings-controller.js`,
    `connection-controller.js` (F-01/F-02/F-03/F-10 inkl. fail-closed Kill-Switch).
  - View: Popup-SPA mit Schichten 1-3 + Einstellungen (F-03/F-05/F-06/F-18, OP-6-Eintraege).
  - `background.js`: Lifecycle, Auto-Connect (F-09), Native-Port-Halter.
  - `manifest.json` (Permissions: proxy, privacy, notifications, nativeMessaging, storage, <all_urls>).
- Go-Native-Host (`native-host/`, EP-2): `protocol` (stdio-Framing + Schema),
  `config` (.conf-Rendering), `broker` (OP-7 L4 Single-Lock, Refcount, dyn. Ports),
  `proc` (wireproxy Runner-Interface), `keystore` (Windows DPAPI L4; darwin/linux
  Datei-ACL L3), `cmd/host` (stdio-Loop). Native-Messaging-Manifest-Template.
- Distribution (`dist/`, EP-1 O-A): Installer `install_windows.ps1` / `install_unix.sh`,
  wireproxy-Pinning `dist/wireproxy/VERSIONS.md`.

### Verifiziert
- Extension-Unit-Tests gruen (Node `node --test`, 19/19): conf-parser, validation,
  settings/notify-Filter, native-Protokoll-Envelope.
- `manifest.json` + Host-Manifest-Template JSON-valide.

### Offen (nicht verifiziert)
- Go-Build/Unit-Tests (`protocol_test.go`, `broker_test.go`): Go-Toolchain lokal
  nicht installiert -> nicht ausgefuehrt. Code review-geprueft, Ausfuehrung ausstehend.
- Keystore darwin/linux: MVP-Datei-ACL (L3); Upgrade auf Keychain/libsecret (L4) offen.
- Smoke-/Leak-Check gegen echten Endpoint (M4 DoD): wireproxy-Binary nicht gebuendelt.

## [0.1.0] - 2026-07-15

### Hinzugefuegt
- Initiales Scaffold (project: WireGuard-BrowserExtension) via std-workflow:
  Root-MVC-Dirs (`models/`, `controllers/`, `services/`, `templates/`),
  `modules/`, `tests/`, Pflicht-Doku, `.gitignore`, `restore.py`.
- Split aus `WireGuard_BrowserExtension/`: dieses Root = generischer
  WireGuard-Peer-Client (Datenebene, manuelle Configs). Gemeinsame
  Vorarbeit nach `z_INFOS/` kopiert.

### Geaendert
- Doku (README, MVC, ERKLAERUNG, INFRA) aus Stub auf Projekt-Inhalt:
  reiner WireGuard-Client-Scope, Control-Plane-Teile entfernt (jetzt in
  `TailScale-BrowserExtension/`).

### Verifiziert
- Scaffold idempotent. Struktur + Pflicht-Doku vollstaendig, nicht leer.
