// Package protocol implementiert das Native-Messaging-Framing (4-Byte-Laenge +
// UTF-8 JSON, Firefox-Standard) und das Message-Schema (Plan 5).
package protocol

import (
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
)

// MaxMessage begrenzt eine einzelne Nachricht (Firefox-Limit 1 MB).
const MaxMessage = 1 << 20

// Request: Extension -> Host.
type Request struct {
	ID        int             `json:"id"`
	Type      string          `json:"type"`
	ProfileID string          `json:"profileId"`
	Payload   json.RawMessage `json:"payload"`
}

// Response: Host -> Extension, korreliert ueber ID.
type Response struct {
	ID      int         `json:"id"`
	OK      bool        `json:"ok"`
	Payload interface{} `json:"payload,omitempty"`
	Error   *ErrObj     `json:"error,omitempty"`
}

// Event: Host-initiiert (ID 0), Status-Push.
type Event struct {
	ID      int         `json:"id"`
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

// ErrObj: Fehler-Nutzlast (Codes siehe Plan 5.4).
type ErrObj struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// ReadMessage liest genau eine gerahmte Nachricht als Rohbytes.
func ReadMessage(r io.Reader) ([]byte, error) {
	var lenBuf [4]byte
	if _, err := io.ReadFull(r, lenBuf[:]); err != nil {
		return nil, err
	}
	n := binary.LittleEndian.Uint32(lenBuf[:])
	if n == 0 {
		return []byte{}, nil
	}
	if n > MaxMessage {
		return nil, errors.New("protocol: message exceeds max size")
	}
	buf := make([]byte, n)
	if _, err := io.ReadFull(r, buf); err != nil {
		return nil, err
	}
	return buf, nil
}

// WriteMessage rahmt und schreibt v als JSON (4-Byte-LE-Laenge + Body).
func WriteMessage(w io.Writer, v interface{}) error {
	body, err := json.Marshal(v)
	if err != nil {
		return err
	}
	if len(body) > MaxMessage {
		return errors.New("protocol: message exceeds max size")
	}
	var lenBuf [4]byte
	binary.LittleEndian.PutUint32(lenBuf[:], uint32(len(body)))
	if _, err := w.Write(lenBuf[:]); err != nil {
		return err
	}
	_, err = w.Write(body)
	return err
}

// DecodeRequest parst Rohbytes zu einer Request.
func DecodeRequest(b []byte) (*Request, error) {
	var req Request
	if err := json.Unmarshal(b, &req); err != nil {
		return nil, err
	}
	return &req, nil
}

// OK/Err bauen Response-Objekte.
func OK(id int, payload interface{}) Response      { return Response{ID: id, OK: true, Payload: payload} }
func Err(id int, code, msg string) Response {
	return Response{ID: id, OK: false, Error: &ErrObj{Code: code, Message: msg}}
}
