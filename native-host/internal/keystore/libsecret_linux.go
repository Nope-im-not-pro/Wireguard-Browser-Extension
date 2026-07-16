//go:build linux

// Linux-Schutz. MVP: Dateibasis mit 0600-Perms im nutzergeschuetzten Verzeichnis
// (entspricht OP-4 L3). Upgrade auf L4 (libsecret via zalando/go-keyring) ist
// Folgearbeit; hier bewusst dependency-frei, damit der Host ohne externe Module baut.
// Sicherheitsgrenze in ERKLAERUNG.md.
package keystore

func protect(plain []byte) ([]byte, error)    { return plain, nil }
func unprotect(cipher []byte) ([]byte, error) { return cipher, nil }
