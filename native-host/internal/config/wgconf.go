// Package config rendert ein Tunnel-Objekt in eine wireproxy-.conf (Plan 5/6).
// wireproxy nutzt WG-Standardsektionen plus [Socks5] BindAddress.
package config

import (
	"fmt"
	"strings"
)

// Interface spiegelt die persistierten Interface-Felder (ohne Key; Key kommt separat).
type Interface struct {
	Address []string `json:"address"`
	DNS     []string `json:"dns"`
}

// Peer spiegelt die Peer-Felder.
type Peer struct {
	PublicKey           string   `json:"publicKey"`
	Endpoint            string   `json:"endpoint"`
	AllowedIPs          []string `json:"allowedIPs"`
	PersistentKeepalive *int     `json:"persistentKeepalive"`
}

// Tunnel = connect-Payload ohne Key (Plan 5.2 TunnelWithoutKey).
type Tunnel struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Interface Interface `json:"interface"`
	Peer      Peer      `json:"peer"`
}

// Render erzeugt den wireproxy-.conf-Text. privateKey wird eingesetzt (transient),
// socksPort bestimmt die lokale SOCKS5-Bindung.
func Render(t *Tunnel, privateKey string, socksPort int) string {
	var b strings.Builder
	b.WriteString("[Interface]\n")
	b.WriteString("PrivateKey = " + privateKey + "\n")
	if len(t.Interface.Address) > 0 {
		b.WriteString("Address = " + strings.Join(t.Interface.Address, ", ") + "\n")
	}
	if len(t.Interface.DNS) > 0 {
		b.WriteString("DNS = " + strings.Join(t.Interface.DNS, ", ") + "\n")
	}
	b.WriteString("\n[Peer]\n")
	b.WriteString("PublicKey = " + t.Peer.PublicKey + "\n")
	b.WriteString("Endpoint = " + t.Peer.Endpoint + "\n")
	allowed := t.Peer.AllowedIPs
	if len(allowed) == 0 {
		allowed = []string{"0.0.0.0/0", "::/0"}
	}
	b.WriteString("AllowedIPs = " + strings.Join(allowed, ", ") + "\n")
	if t.Peer.PersistentKeepalive != nil {
		b.WriteString(fmt.Sprintf("PersistentKeepalive = %d\n", *t.Peer.PersistentKeepalive))
	}
	// wireproxy-SOCKS5-Frontend, nur Loopback.
	b.WriteString("\n[Socks5]\n")
	b.WriteString(fmt.Sprintf("BindAddress = 127.0.0.1:%d\n", socksPort))
	return b.String()
}
