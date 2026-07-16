// Package broker verwaltet wireproxy-Instanzen keyed per Firefox-Profil-ID (OP-7).
// MVP = Single-Lock (L4): nur ein Profil gleichzeitig aktiv. Refcount + dynamische
// Ports sind bereits angelegt, damit Upgrade auf L3 (Multi-Profil) ohne API-Bruch geht.
package broker

import (
	"errors"
	"net"
	"sync"

	"wireguard-browser-host/internal/config"
	"wireguard-browser-host/internal/proc"
	"wireguard-browser-host/internal/protocol"
)

// KeyResolver liefert den PrivateKey zu einer Keystore-Referenz.
type KeyResolver interface {
	Get(ref string) (string, error)
}

// Broker orchestriert Instanzen. EventSink pusht Host-Events an die Extension.
type Broker struct {
	mu         sync.Mutex
	runner     proc.Runner
	keys       KeyResolver
	singleLock bool
	instances  map[string]*instance
	EventSink  func(protocol.Event)
}

type instance struct {
	port     int
	tunnelID string
	p        proc.Proc
	refs     int
	stopping bool
}

// New erzeugt einen Broker. singleLock=true entspricht dem MVP-Rueckfall (L4).
func New(runner proc.Runner, keys KeyResolver, singleLock bool) *Broker {
	return &Broker{
		runner:     runner,
		keys:       keys,
		singleLock: singleLock,
		instances:  make(map[string]*instance),
		EventSink:  func(protocol.Event) {},
	}
}

// Connect startet (oder referenziert) eine Instanz fuer profileID und liefert den SOCKS-Port.
func (b *Broker) Connect(profileID string, t *config.Tunnel, keyRef string) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if inst, ok := b.instances[profileID]; ok {
		inst.refs++
		return inst.port, nil
	}
	// Single-Lock (L4): zweites Profil wird abgewiesen (F-15).
	if b.singleLock && len(b.instances) > 0 {
		return 0, errors.New("single-lock: bereits ein Profil verbunden")
	}

	privateKey, err := b.keys.Get(keyRef)
	if err != nil {
		return 0, err
	}
	port, err := freePort()
	if err != nil {
		return 0, err
	}
	confText := config.Render(t, privateKey, port)
	p, err := b.runner.Start(confText, port)
	if err != nil {
		return 0, err
	}
	inst := &instance{port: port, tunnelID: t.ID, p: p, refs: 1}
	b.instances[profileID] = inst

	// Prozessende ueberwachen -> wireproxy-exit-Event (unexpected, wenn nicht via Disconnect).
	go b.watch(profileID, inst)
	b.EventSink(protocol.Event{ID: 0, Type: "status-changed", Payload: map[string]interface{}{"status": "connected", "socksPort": port}})
	return port, nil
}

func (b *Broker) watch(profileID string, inst *instance) {
	inst.p.Wait()
	b.mu.Lock()
	unexpected := !inst.stopping
	if b.instances[profileID] == inst {
		delete(b.instances, profileID)
	}
	b.mu.Unlock()
	b.EventSink(protocol.Event{ID: 0, Type: "wireproxy-exit", Payload: map[string]interface{}{"code": 0, "unexpected": unexpected}})
}

// Disconnect senkt den Refcount; bei 0 wird die Instanz gestoppt.
func (b *Broker) Disconnect(profileID string) error {
	b.mu.Lock()
	inst, ok := b.instances[profileID]
	if !ok {
		b.mu.Unlock()
		return nil
	}
	inst.refs--
	if inst.refs > 0 {
		b.mu.Unlock()
		return nil
	}
	inst.stopping = true
	delete(b.instances, profileID)
	b.mu.Unlock()
	return inst.p.Stop()
}

// Status liefert Zustand fuer profileID (Plan 3.3-artig).
func (b *Broker) Status(profileID string) map[string]interface{} {
	b.mu.Lock()
	defer b.mu.Unlock()
	if inst, ok := b.instances[profileID]; ok {
		return map[string]interface{}{"status": "connected", "socksPort": inst.port, "lastError": nil}
	}
	return map[string]interface{}{"status": "disconnected", "socksPort": nil, "lastError": nil}
}

// freePort ermittelt einen freien Loopback-TCP-Port (dynamische Vergabe OP-7).
func freePort() (int, error) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	defer l.Close()
	return l.Addr().(*net.TCPAddr).Port, nil
}
