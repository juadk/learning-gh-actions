package helpers

import (
	"io/ioutil"
	"path"

	"github.com/mholt/archiver/v3"
	"github.com/pkg/errors"
)

func Tar(dir string) (string, string, error) {
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return "", "", errors.Wrap(err, "cannot read the apps source files")
	}
	sources := []string{}
	for _, f := range files {
		// The FileInfo entries returned by ReadDir provide
		// only the base name of the file or directory they
		// are for. We have to add back the path of the
		// application directory to get the proper paths to
		// the files and directories to assemble in the
		// tarball.
		// Ignore git config files in the app sources.
		if f.Name() == ".git" || f.Name() == ".gitignore" || f.Name() == ".gitmodules" || f.Name() == ".gitconfig" || f.Name() == ".git-credentials" {
			continue
		}
		sources = append(sources, path.Join(dir, f.Name()))
	}

	// create a tmpDir - tarball dir and POST
	tmpDir, err := ioutil.TempDir("", "epinio-app")
	if err != nil {
		return "", "", errors.Wrap(err, "can't create temp directory")
	}

	tarball := path.Join(tmpDir, "blob.tar")
	err = archiver.Archive(sources, tarball)
	if err != nil {
		return tmpDir, "", errors.Wrap(err, "can't create archive")
	}

	return tmpDir, tarball, nil
}
