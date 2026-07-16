#!/usr/bin/env bash
# Installer macOS/Linux (Plan 9.2, EP-1 O-A).
# Kopiert Host + wireproxy in nutzergebundenes Verzeichnis und legt das
# Native-Messaging-Manifest an der von Firefox erwarteten Stelle ab.
set -euo pipefail

HOST_NAME="wireguard_browser_host"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNAME="$(uname -s)"

if [ "$UNAME" = "Darwin" ]; then
  INSTALL_DIR="$HOME/Library/Application Support/WireGuardBrowserHost"
  MANIFEST_DIR="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
  ARCH="$(uname -m)"; [ "$ARCH" = "x86_64" ] && ARCH="amd64"
  WIREPROXY_SRC="$SCRIPT_DIR/../wireproxy/darwin/$ARCH/wireproxy"
else
  INSTALL_DIR="$HOME/.local/share/wireguard-browser-host"
  MANIFEST_DIR="$HOME/.mozilla/native-messaging-hosts"
  ARCH="$(uname -m)"; [ "$ARCH" = "x86_64" ] && ARCH="amd64"
  WIREPROXY_SRC="$SCRIPT_DIR/../wireproxy/linux/$ARCH/wireproxy"
fi

HOST_SRC="$SCRIPT_DIR/../../native-host/bin/host"
MANIFEST_TEMPLATE="$SCRIPT_DIR/../../native-host/manifest/wireguard_browser_host.json"

mkdir -p "$INSTALL_DIR" "$MANIFEST_DIR"
install -m 0755 "$HOST_SRC" "$INSTALL_DIR/host"
install -m 0755 "$WIREPROXY_SRC" "$INSTALL_DIR/wireproxy"

HOST_PATH="$INSTALL_DIR/host"
sed "s#__HOST_BINARY_PATH__#$HOST_PATH#" "$MANIFEST_TEMPLATE" > "$MANIFEST_DIR/$HOST_NAME.json"
chmod 0644 "$MANIFEST_DIR/$HOST_NAME.json"

echo "Installiert nach $INSTALL_DIR; Manifest: $MANIFEST_DIR/$HOST_NAME.json"
echo "Setze WIREPROXY_BIN=$INSTALL_DIR/wireproxy in der Umgebung des Hosts (der Host liest es beim Start)."
