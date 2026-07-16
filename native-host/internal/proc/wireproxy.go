// Package proc kapselt Start/Stop/Health von wireproxy (Plan 5.2).
// Runner-Interface erlaubt Mock-wireproxy in Tests (Broker-DoD).
package proc

import (
	"crypto/rand"
	"encoding/hex"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"
)

// confGlob matcht Conf-Dateien dieser Anwendung im TempDir (Recovery/Cleanup).
const confPrefix = "wg-browser-"
const confGlob = confPrefix + "*.conf"

// Proc: laufender wireproxy-Prozess.
type Proc interface {
	Wait() error // blockiert bis Prozessende
	Stop() error // beendet den Prozess
	Pid() int
}

// Runner: startet einen wireproxy mit gegebenem .conf-Text.
type Runner interface {
	Start(confText string, port int) (Proc, error)
}

// ExecRunner startet das echte wireproxy-Binary. binPath aus WIREPROXY_BIN oder "wireproxy".
type ExecRunner struct {
	BinPath string
	TempDir string
}

func NewExecRunner() *ExecRunner {
	bin := os.Getenv("WIREPROXY_BIN")
	if bin == "" {
		bin = "wireproxy"
	}
	return &ExecRunner{BinPath: bin, TempDir: os.TempDir()}
}

func (r *ExecRunner) Start(confText string, port int) (Proc, error) {
	// B4: verwaiste Conf-Dateien frueherer (evtl. per kill -9 gecrashter) Instanzen
	// aufraeumen, bevor eine neue geschrieben wird. Klartext-Key bleibt sonst liegen.
	r.cleanupOrphans()

	confPath, err := r.writeConf(confText, port)
	if err != nil {
		return nil, err
	}
	cmd := exec.Command(r.BinPath, "-c", confPath)
	cmd.Stdout = nil
	cmd.Stderr = nil
	if err := cmd.Start(); err != nil {
		os.Remove(confPath)
		return nil, err
	}
	return &execProc{cmd: cmd, confPath: confPath}, nil
}

// writeConf legt die Conf mit O_EXCL|0600 unter zufaelligem Namen an.
// O_EXCL verhindert Anhaengen an vorbestehende Datei / Symlink-Ueberschreiben;
// das Zufallssuffix schliesst das Symlink-Race-Fenster (kein vorhersagbarer Name).
func (r *ExecRunner) writeConf(confText string, port int) (string, error) {
	suffix, err := randSuffix()
	if err != nil {
		return "", err
	}
	confPath := filepath.Join(r.TempDir, confPrefix+strconv.Itoa(port)+"-"+suffix+".conf")
	f, err := os.OpenFile(confPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return "", err
	}
	if _, err := f.Write([]byte(confText)); err != nil {
		f.Close()
		os.Remove(confPath)
		return "", err
	}
	if err := f.Close(); err != nil {
		os.Remove(confPath)
		return "", err
	}
	return confPath, nil
}

// cleanupOrphans entfernt zurueckgebliebene Conf-Dateien im TempDir. Best-effort:
// Fehler werden ignoriert (Recovery-Pfad, kein Grund den Start zu blockieren).
func (r *ExecRunner) cleanupOrphans() {
	matches, err := filepath.Glob(filepath.Join(r.TempDir, confGlob))
	if err != nil {
		return
	}
	for _, m := range matches {
		os.Remove(m)
	}
}

func randSuffix() (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

type execProc struct {
	cmd      *exec.Cmd
	confPath string
	once     sync.Once
}

func (p *execProc) Wait() error {
	err := p.cmd.Wait()
	p.cleanup()
	return err
}

func (p *execProc) Stop() error {
	if p.cmd.Process == nil {
		return nil
	}
	err := p.cmd.Process.Kill()
	p.cleanup()
	return err
}

func (p *execProc) Pid() int {
	if p.cmd.Process == nil {
		return 0
	}
	return p.cmd.Process.Pid
}

func (p *execProc) cleanup() {
	p.once.Do(func() {
		if p.confPath != "" {
			os.Remove(p.confPath)
		}
	})
}
