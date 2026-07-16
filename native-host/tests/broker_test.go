package tests

import (
	"sync"
	"testing"

	"wireguard-browser-host/internal/broker"
	"wireguard-browser-host/internal/config"
	"wireguard-browser-host/internal/proc"
)

// --- Mocks (Mock-wireproxy, Broker-DoD) ---

type fakeProc struct {
	done    chan struct{}
	stopped bool
	once    sync.Once
}

func newFakeProc() *fakeProc { return &fakeProc{done: make(chan struct{})} }
func (p *fakeProc) Wait() error {
	<-p.done
	return nil
}
func (p *fakeProc) Stop() error {
	p.once.Do(func() { p.stopped = true; close(p.done) })
	return nil
}
func (p *fakeProc) Pid() int { return 4242 }

type fakeRunner struct {
	mu     sync.Mutex
	starts int
	last   *fakeProc
}

func (r *fakeRunner) Start(confText string, port int) (proc.Proc, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.starts++
	r.last = newFakeProc()
	return r.last, nil
}

type fakeKeys struct{}

func (fakeKeys) Get(ref string) (string, error) { return "PRIVATEKEYVALUE", nil }

func sampleTunnel() *config.Tunnel {
	return &config.Tunnel{
		ID:   "t1",
		Name: "sample",
		Peer: config.Peer{PublicKey: "PUB", Endpoint: "h:51820", AllowedIPs: []string{"0.0.0.0/0"}},
	}
}

// --- Tests ---

func TestConnectReturnsPortAndStarts(t *testing.T) {
	r := &fakeRunner{}
	b := broker.New(r, fakeKeys{}, true)
	port, err := b.Connect("profA", sampleTunnel(), "ref1")
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	if port <= 0 {
		t.Fatalf("ungueltiger Port: %d", port)
	}
	if r.starts != 1 {
		t.Fatalf("erwartete 1 Start, war %d", r.starts)
	}
}

func TestSingleLockRejectsSecondProfile(t *testing.T) {
	r := &fakeRunner{}
	b := broker.New(r, fakeKeys{}, true)
	if _, err := b.Connect("profA", sampleTunnel(), "ref1"); err != nil {
		t.Fatalf("erster connect: %v", err)
	}
	if _, err := b.Connect("profB", sampleTunnel(), "ref2"); err == nil {
		t.Fatalf("zweites Profil haette abgewiesen werden muessen (single-lock)")
	}
}

func TestRefcountKeepsInstanceUntilZero(t *testing.T) {
	r := &fakeRunner{}
	b := broker.New(r, fakeKeys{}, true)
	p1, _ := b.Connect("profA", sampleTunnel(), "ref1")
	p2, _ := b.Connect("profA", sampleTunnel(), "ref1") // gleiche Profil-ID -> refcount++
	if p1 != p2 {
		t.Fatalf("gleiche Profil-ID sollte gleichen Port liefern: %d != %d", p1, p2)
	}
	if r.starts != 1 {
		t.Fatalf("kein zweiter Start bei refcount++, war %d", r.starts)
	}
	// erster Disconnect: Instanz bleibt (refs 2->1).
	if err := b.Disconnect("profA"); err != nil {
		t.Fatalf("disconnect1: %v", err)
	}
	if r.last.stopped {
		t.Fatalf("Prozess zu frueh gestoppt")
	}
	// zweiter Disconnect: refs 1->0 -> Stop.
	if err := b.Disconnect("profA"); err != nil {
		t.Fatalf("disconnect2: %v", err)
	}
	if !r.last.stopped {
		t.Fatalf("Prozess haette gestoppt sein muessen")
	}
}

func TestStatusReflectsConnection(t *testing.T) {
	r := &fakeRunner{}
	b := broker.New(r, fakeKeys{}, true)
	st := b.Status("profA")
	if st["status"] != "disconnected" {
		t.Fatalf("erwartet disconnected, war %v", st["status"])
	}
	b.Connect("profA", sampleTunnel(), "ref1")
	st = b.Status("profA")
	if st["status"] != "connected" {
		t.Fatalf("erwartet connected, war %v", st["status"])
	}
}
