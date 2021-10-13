package testenv

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/epinio/epinio/acceptance/helpers/proc"
)

const (
	// skipCleanupPath is the path (relative to the test
	// directory) of a file which, when present causes the system
	// to not delete the test cluster after the tests are done.
	skipCleanupPath = "/tmp/skip_cleanup"
)

// SkipCleanup returns true if the file exists, false if some error occurred
// while checking
func SkipCleanup() bool {
	_, err := os.Stat(root + skipCleanupPath)
	return err == nil
}

func SkipCleanupPath() string {
	return root + skipCleanupPath
}

func DeleteTmpDir(nodeTmpDir string) {
	err := os.RemoveAll(nodeTmpDir)
	if err != nil {
		panic(fmt.Sprintf("Failed deleting temp dir %s: %s\n",
			nodeTmpDir, err.Error()))
	}
}

// Remove all tmp directories from /tmp/epinio-* . Test should try to cleanup
// after themselves but that sometimes doesn't happen, either because we forgot
// the cleanup code or because the test failed before that happened.
// NOTE: This code will create problems if more than one acceptance_suite_test.go
// is run in parallel (e.g. two PRs on one worker). However we keep it as an
// extra measure.
func CleanupTmp() (string, error) {
	temps, err := filepath.Glob("/tmp/epinio-*")
	if err != nil {
		return "", err
	}
	return proc.Run("", true, "rm", append([]string{"-rf"}, temps...)...)
}

// CopyEpinioConfig copies the epinio yaml to the given dir
func CopyEpinioConfig(dir string) (string, error) {
	return proc.Run("", false, "cp", EpinioYAML(), dir+"/epinio.yaml")
}
