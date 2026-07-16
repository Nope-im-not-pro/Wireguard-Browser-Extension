//go:build windows

// DPAPI-Schutz (Windows) via crypt32 CryptProtectData/CryptUnprotectData.
// Nur stdlib + syscall, keine externen Module. OS-gebundene Entschluesselung
// (CurrentUser-Scope) = OP-4 L4 auf Windows.
package keystore

import (
	"errors"
	"syscall"
	"unsafe"
)

var (
	crypt32               = syscall.NewLazyDLL("crypt32.dll")
	kernel32              = syscall.NewLazyDLL("kernel32.dll")
	procCryptProtectData  = crypt32.NewProc("CryptProtectData")
	procCryptUnprotect    = crypt32.NewProc("CryptUnprotectData")
	procLocalFree         = kernel32.NewProc("LocalFree")
)

const cryptprotectUIForbidden = 0x1

type dataBlob struct {
	cbData uint32
	pbData *byte
}

func newBlob(d []byte) dataBlob {
	if len(d) == 0 {
		return dataBlob{}
	}
	return dataBlob{cbData: uint32(len(d)), pbData: &d[0]}
}

func (b dataBlob) bytes() []byte {
	out := make([]byte, b.cbData)
	copy(out, unsafe.Slice(b.pbData, b.cbData))
	return out
}

func protect(plain []byte) ([]byte, error) {
	in := newBlob(plain)
	var out dataBlob
	r, _, err := procCryptProtectData.Call(
		uintptr(unsafe.Pointer(&in)), 0, 0, 0, 0,
		uintptr(cryptprotectUIForbidden), uintptr(unsafe.Pointer(&out)),
	)
	if r == 0 {
		return nil, errors.New("CryptProtectData: " + err.Error())
	}
	defer procLocalFree.Call(uintptr(unsafe.Pointer(out.pbData)))
	return out.bytes(), nil
}

func unprotect(cipher []byte) ([]byte, error) {
	in := newBlob(cipher)
	var out dataBlob
	r, _, err := procCryptUnprotect.Call(
		uintptr(unsafe.Pointer(&in)), 0, 0, 0, 0,
		uintptr(cryptprotectUIForbidden), uintptr(unsafe.Pointer(&out)),
	)
	if r == 0 {
		return nil, errors.New("CryptUnprotectData: " + err.Error())
	}
	defer procLocalFree.Call(uintptr(unsafe.Pointer(out.pbData)))
	return out.bytes(), nil
}
