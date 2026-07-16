//go:build darwin

// macOS-Schutz. MVP: Dateibasis mit 0600-Perms im nutzergeschuetzten Verzeichnis
// (entspricht OP-4 L3, ACL wie WireGuard-eigene .conf). Upgrade auf L4 (Keychain
// via keybase/go-keychain) ist Folgearbeit; hier bewusst dependency-frei gehalten,
// damit der Host ohne cgo/externe Module baut. Sicherheitsgrenze in ERKLAERUNG.md.
package keystore

// protect/unprotect als Identitaet: at-rest-Schutz liefert die Datei-Perm + Verzeichnis-ACL.
func protect(plain []byte) ([]byte, error)    { return plain, nil }
func unprotect(cipher []byte) ([]byte, error) { return cipher, nil }
