package application

import (
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path"

	"github.com/epinio/epinio/deployments"
	"github.com/epinio/epinio/helpers/kubernetes"
	"github.com/epinio/epinio/helpers/tracelog"
	"github.com/epinio/epinio/internal/api/v1/response"
	"github.com/epinio/epinio/internal/cli/server/requestctx"
	"github.com/epinio/epinio/internal/s3manager"
	apierror "github.com/epinio/epinio/pkg/api/core/v1/errors"
	"github.com/epinio/epinio/pkg/api/core/v1/models"

	"github.com/julienschmidt/httprouter"
)

// Upload handles the API endpoint /orgs/:org/applications/:app/store.
// It receives the application data as a tarball and stores it. Then
// it creates the k8s resources needed for staging
func (hc Controller) Upload(w http.ResponseWriter, r *http.Request) apierror.APIErrors {
	ctx := r.Context()
	log := tracelog.Logger(ctx)

	params := httprouter.ParamsFromContext(ctx)
	org := params.ByName("org")
	name := params.ByName("app")

	log.Info("processing upload", "org", org, "app", name)

	log.V(2).Info("parsing multipart form")

	file, _, err := r.FormFile("file")
	if err != nil {
		return apierror.BadRequest(err, "can't read multipart file input")
	}
	defer file.Close()

	tmpDir, err := ioutil.TempDir("", "epinio-app")
	if err != nil {
		return apierror.InternalError(err, "can't create temp directory")
	}
	defer os.RemoveAll(tmpDir)

	blob := path.Join(tmpDir, "blob.tar")
	f, err := os.OpenFile(blob, os.O_WRONLY|os.O_CREATE, 0666)
	if err != nil {
		return apierror.InternalError(err, "failed create file for writing app sources to temp location")
	}
	defer f.Close()

	_, err = io.Copy(f, file)
	if err != nil {
		return apierror.InternalError(err, "failed to copy app sources to temp location")
	}

	cluster, err := kubernetes.GetCluster(ctx)
	if err != nil {
		return apierror.InternalError(err, "failed to get access to a kube client")
	}

	connectionDetails, err := s3manager.GetConnectionDetails(ctx, cluster, deployments.TektonStagingNamespace, deployments.S3ConnectionDetailsSecret)
	if err != nil {
		return apierror.InternalError(err, "fetching the S3 connection details from the Kubernetes secret")
	}
	manager, err := s3manager.New(connectionDetails)
	if err != nil {
		return apierror.InternalError(err, "creating an S3 manager")
	}

	username := requestctx.User(ctx)
	blobUID, err := manager.Upload(ctx, blob, map[string]string{
		"app": name, "org": org, "username": username,
	})
	if err != nil {
		return apierror.InternalError(err, "uploading the application sources blob")
	}

	log.Info("uploaded app", "org", org, "app", name, "blobUID", blobUID)

	resp := models.UploadResponse{BlobUID: blobUID}
	err = response.JSON(w, resp)
	if err != nil {
		return apierror.InternalError(err)
	}

	return nil
}
