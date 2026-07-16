// Command host ist der Native-Messaging-Host (EP-2, Plan 5).
// stdio-Loop: liest gerahmte Requests, dispatcht, schreibt Responses/Events.
package main

import (
	"encoding/json"
	"io"
	"os"
	"strings"
	"sync"

	"wireguard-browser-host/internal/broker"
	"wireguard-browser-host/internal/config"
	"wireguard-browser-host/internal/keystore"
	"wireguard-browser-host/internal/proc"
	"wireguard-browser-host/internal/protocol"
)

const (
	hostVersion      = "0.1.0"
	wireproxyVersion = "pinned" // real: aus dist/wireproxy/VERSIONS.md
)

// host haelt gemeinsamen Writer (mutex-geschuetzt) + Broker.
type host struct {
	wmu    sync.Mutex
	out    io.Writer
	keys   keystore.Store
	broker *broker.Broker
}

func (h *host) send(v interface{}) {
	h.wmu.Lock()
	defer h.wmu.Unlock()
	_ = protocol.WriteMessage(h.out, v)
}

func main() {
	ks, err := keystore.New()
	if err != nil {
		// Ohne Keystore kein sicherer Betrieb; sauberer Abbruch.
		os.Exit(1)
	}
	h := &host{out: os.Stdout, keys: ks}
	h.broker = broker.New(proc.NewExecRunner(), ks, true /* singleLock MVP L4 */)
	h.broker.EventSink = func(ev protocol.Event) { h.send(ev) }

	h.loop(os.Stdin)
}

func (h *host) loop(in io.Reader) {
	for {
		raw, err := protocol.ReadMessage(in)
		if err != nil {
			return // EOF / Port geschlossen -> Host beenden
		}
		req, err := protocol.DecodeRequest(raw)
		if err != nil {
			continue
		}
		h.dispatch(req)
	}
}

func (h *host) dispatch(req *protocol.Request) {
	switch req.Type {
	case "health":
		h.send(protocol.OK(req.ID, map[string]string{"version": hostVersion, "wireproxyVersion": wireproxyVersion}))

	case "import-key":
		var p struct {
			PrivateKey string `json:"privateKey"`
		}
		if err := json.Unmarshal(req.Payload, &p); err != nil || p.PrivateKey == "" {
			h.send(protocol.Err(req.ID, "E_KEYSTORE", "PrivateKey fehlt"))
			return
		}
		ref, err := h.keys.Import(p.PrivateKey)
		if err != nil {
			h.send(protocol.Err(req.ID, "E_KEYSTORE", err.Error()))
			return
		}
		h.send(protocol.OK(req.ID, map[string]string{"privateKeyRef": ref}))

	case "drop-key":
		var p struct {
			PrivateKeyRef string `json:"privateKeyRef"`
		}
		json.Unmarshal(req.Payload, &p)
		if err := h.keys.Delete(p.PrivateKeyRef); err != nil {
			h.send(protocol.Err(req.ID, "E_KEYSTORE", err.Error()))
			return
		}
		h.send(protocol.OK(req.ID, map[string]interface{}{}))

	case "connect":
		var p struct {
			Tunnel        config.Tunnel `json:"tunnel"`
			PrivateKeyRef string        `json:"privateKeyRef"`
		}
		if err := json.Unmarshal(req.Payload, &p); err != nil {
			h.send(protocol.Err(req.ID, "E_HANDSHAKE", "ungueltige connect-Payload"))
			return
		}
		port, err := h.broker.Connect(req.ProfileID, &p.Tunnel, p.PrivateKeyRef)
		if err != nil {
			h.send(protocol.Err(req.ID, mapConnectErr(err), err.Error()))
			return
		}
		h.send(protocol.OK(req.ID, map[string]int{"socksPort": port}))

	case "disconnect":
		if err := h.broker.Disconnect(req.ProfileID); err != nil {
			h.send(protocol.Err(req.ID, "E_WIREPROXY_SPAWN", err.Error()))
			return
		}
		h.send(protocol.OK(req.ID, map[string]interface{}{}))

	case "status":
		h.send(protocol.OK(req.ID, h.broker.Status(req.ProfileID)))

	default:
		h.send(protocol.Err(req.ID, "E_HANDSHAKE", "unbekannter Typ: "+req.Type))
	}
}

// mapConnectErr ordnet Broker-Fehler den Plan-5.4-Codes zu.
func mapConnectErr(err error) string {
	msg := err.Error()
	if strings.Contains(msg, "single-lock") {
		return "E_PORT_EXHAUSTED"
	}
	if strings.Contains(msg, "keystore") {
		return "E_KEYSTORE"
	}
	return "E_WIREPROXY_SPAWN"
}
