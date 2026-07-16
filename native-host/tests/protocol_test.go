package tests

import (
	"bytes"
	"encoding/binary"
	"testing"

	"wireguard-browser-host/internal/protocol"
)

func TestFramingRoundTrip(t *testing.T) {
	var buf bytes.Buffer
	req := protocol.Request{ID: 7, Type: "connect", ProfileID: "p1"}
	if err := protocol.WriteMessage(&buf, req); err != nil {
		t.Fatalf("write: %v", err)
	}
	// 4-Byte-LE-Praefix pruefen.
	if buf.Len() < 4 {
		t.Fatalf("zu kurz")
	}
	n := binary.LittleEndian.Uint32(buf.Bytes()[:4])
	if int(n) != buf.Len()-4 {
		t.Fatalf("laenge stimmt nicht: prefix=%d body=%d", n, buf.Len()-4)
	}

	raw, err := protocol.ReadMessage(&buf)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	got, err := protocol.DecodeRequest(raw)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.ID != 7 || got.Type != "connect" || got.ProfileID != "p1" {
		t.Fatalf("roundtrip falsch: %+v", got)
	}
}

func TestReadMessageTooLarge(t *testing.T) {
	var buf bytes.Buffer
	var lb [4]byte
	binary.LittleEndian.PutUint32(lb[:], protocol.MaxMessage+1)
	buf.Write(lb[:])
	if _, err := protocol.ReadMessage(&buf); err == nil {
		t.Fatalf("erwartete Fehler bei Ueberlaenge")
	}
}

func TestOKAndErr(t *testing.T) {
	ok := protocol.OK(3, map[string]int{"socksPort": 40000})
	if !ok.OK || ok.ID != 3 {
		t.Fatalf("OK falsch: %+v", ok)
	}
	e := protocol.Err(4, "E_HANDSHAKE", "boom")
	if e.OK || e.Error == nil || e.Error.Code != "E_HANDSHAKE" {
		t.Fatalf("Err falsch: %+v", e)
	}
}
