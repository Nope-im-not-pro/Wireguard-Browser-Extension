package tests

// B4-Haertung: echter ExecRunner (kein Mock) gegen ein selbst-kompiliertes
// Dummy-"wireproxy". Prueft Conf-Anlage 0600, Entfernung nach Stop und
// Recovery verwaister Conf-Dateien beim naechsten Start.

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"

	"wireguard-browser-host/internal/proc"
)

// buildDummyBin kompiliert ein triviales, blockierendes Ersatz-Binary. Stdlib-only,
// daher modul-frei baubar. Rueckgabe = Pfad zum Binary.
func buildDummyBin(t *testing.T, dir string) string {
	t.Helper()
	src := filepath.Join(dir, "dummy.go")
	code := "package main\nimport \"time\"\nfunc main(){ time.Sleep(60 * time.Second) }\n"
	if err := os.WriteFile(src, []byte(code), 0o644); err != nil {
		t.Fatalf("dummy-quelle schreiben: %v", err)
	}
	bin := filepath.Join(dir, "dummy")
	if runtime.GOOS == "windows" {
		bin += ".exe"
	}
	if out, err := exec.Command("go", "build", "-o", bin, src).CombinedOutput(); err != nil {
		t.Fatalf("dummy bauen: %v\n%s", err, out)
	}
	return bin
}

func globConfs(t *testing.T, dir string) []string {
	t.Helper()
	m, err := filepath.Glob(filepath.Join(dir, "wg-browser-*.conf"))
	if err != nil {
		t.Fatalf("glob: %v", err)
	}
	return m
}

func TestExecRunnerConfLifecycle(t *testing.T) {
	work := t.TempDir() // Dummy-Bin + Quelle
	tmp := t.TempDir()  // dedizierter TempDir fuer Conf-Dateien
	bin := buildDummyBin(t, work)

	r := &proc.ExecRunner{BinPath: bin, TempDir: tmp}

	p, err := r.Start("[Interface]\nPrivateKey=secret\n", 40001)
	if err != nil {
		t.Fatalf("Start: %v", err)
	}

	confs := globConfs(t, tmp)
	if len(confs) != 1 {
		t.Fatalf("erwartet 1 conf, gefunden %d: %v", len(confs), confs)
	}
	// Windows honoriert Unix-Permbits nicht -> Perm-Assert nur POSIX.
	if runtime.GOOS != "windows" {
		info, err := os.Stat(confs[0])
		if err != nil {
			t.Fatalf("stat conf: %v", err)
		}
		if perm := info.Mode().Perm(); perm != 0o600 {
			t.Fatalf("conf-perm = %o, erwartet 600", perm)
		}
	}

	// Kill kann "process already finished" liefern - Cleanup zaehlt, nicht der err.
	_ = p.Stop()
	if left := globConfs(t, tmp); len(left) != 0 {
		t.Fatalf("conf nach Stop nicht entfernt: %v", left)
	}
}

func TestExecRunnerCleansOrphans(t *testing.T) {
	work := t.TempDir()
	tmp := t.TempDir()
	bin := buildDummyBin(t, work)

	// Verwaiste Conf einer angeblich per kill -9 gecrashten Vor-Instanz.
	orphan := filepath.Join(tmp, "wg-browser-40002-deadbeefdeadbeef.conf")
	if err := os.WriteFile(orphan, []byte("stale-secret"), 0o600); err != nil {
		t.Fatalf("orphan schreiben: %v", err)
	}

	r := &proc.ExecRunner{BinPath: bin, TempDir: tmp}
	p, err := r.Start("[Interface]\n", 40003)
	if err != nil {
		t.Fatalf("Start: %v", err)
	}
	defer p.Stop()

	if _, err := os.Stat(orphan); !os.IsNotExist(err) {
		t.Fatalf("verwaiste conf nicht aufgeraeumt (err=%v)", err)
	}
	if confs := globConfs(t, tmp); len(confs) != 1 {
		t.Fatalf("erwartet genau 1 neue conf, gefunden %d: %v", len(confs), confs)
	}
}
