// Package keystore haelt PrivateKeys at rest OS-geschuetzt (BE-3/OP-4 L3+L4, Plan 5.2).
// Die Extension sieht den Key nur transient beim Import; hier liegt er verschluesselt.
package keystore

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"runtime"
)

// Store: Import legt Key ab und liefert eine opake Referenz; Get/Delete arbeiten darauf.
type Store interface {
	Import(privateKey string) (ref string, err error)
	Get(ref string) (privateKey string, err error)
	Delete(ref string) error
}

// New liefert die plattform-spezifische Implementierung (Dateibasis + OS-protect).
func New() (Store, error) {
	dir, err := keystoreDir()
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	return &fileStore{dir: dir}, nil
}

// keystoreDir: OS-passendes, nutzergebundenes Verzeichnis.
func keystoreDir() (string, error) {
	switch runtime.GOOS {
	case "windows":
		base := os.Getenv("LOCALAPPDATA")
		if base == "" {
			return "", errors.New("LOCALAPPDATA nicht gesetzt")
		}
		return filepath.Join(base, "WireGuardBrowserHost", "keys"), nil
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, "Library", "Application Support", "WireGuardBrowserHost", "keys"), nil
	default:
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, ".local", "share", "wireguard-browser-host", "keys"), nil
	}
}

// fileStore: ein Datei je Key, Inhalt = protect(key). Datei-Perms 0600.
type fileStore struct{ dir string }

func genRef() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}

func (s *fileStore) path(ref string) (string, error) {
	// Ref muss reines Hex sein (kein Pfad-Traversal).
	if _, err := hex.DecodeString(ref); err != nil || ref == "" {
		return "", errors.New("keystore: ungueltige Referenz")
	}
	return filepath.Join(s.dir, ref+".key"), nil
}

func (s *fileStore) Import(privateKey string) (string, error) {
	if privateKey == "" {
		return "", errors.New("keystore: leerer Key")
	}
	ref, err := genRef()
	if err != nil {
		return "", err
	}
	blob, err := protect([]byte(privateKey))
	if err != nil {
		return "", err
	}
	p, err := s.path(ref)
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(p, blob, 0o600); err != nil {
		return "", err
	}
	return ref, nil
}

func (s *fileStore) Get(ref string) (string, error) {
	p, err := s.path(ref)
	if err != nil {
		return "", err
	}
	blob, err := os.ReadFile(p)
	if err != nil {
		return "", err
	}
	plain, err := unprotect(blob)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func (s *fileStore) Delete(ref string) error {
	p, err := s.path(ref)
	if err != nil {
		return err
	}
	err = os.Remove(p)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}
