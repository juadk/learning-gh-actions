package service

import (
	"github.com/epinio/epinio/helpers/kubernetes"
	"github.com/epinio/epinio/internal/api/v1/response"
	"github.com/epinio/epinio/internal/cli/server/requestctx"
	"github.com/epinio/epinio/internal/organizations"
	"github.com/epinio/epinio/internal/services"
	apierror "github.com/epinio/epinio/pkg/api/core/v1/errors"
	"github.com/epinio/epinio/pkg/api/core/v1/models"
	"github.com/gin-gonic/gin"
)

// Create handles the API end point /orgs/:org/services
// It creates the named service from its parameters
func (sc Controller) Create(c *gin.Context) apierror.APIErrors {
	ctx := c.Request.Context()
	org := c.Param("org")
	username := requestctx.User(ctx)

	var createRequest models.ServiceCreateRequest
	err := c.BindJSON(&createRequest)
	if err != nil {
		return apierror.BadRequest(err)
	}

	if createRequest.Name == "" {
		return apierror.NewBadRequest("Cannot create service without a name")
	}

	if len(createRequest.Data) < 1 {
		return apierror.NewBadRequest("Cannot create service without data")
	}

	cluster, err := kubernetes.GetCluster(ctx)
	if err != nil {
		return apierror.InternalError(err)
	}

	exists, err := organizations.Exists(ctx, cluster, org)
	if err != nil {
		return apierror.InternalError(err)
	}
	if !exists {
		return apierror.OrgIsNotKnown(org)
	}

	// Verify that the requested name is not yet used by a different service.
	_, err = services.Lookup(ctx, cluster, org, createRequest.Name)
	if err == nil {
		// no error, service is found, conflict
		return apierror.ServiceAlreadyKnown(createRequest.Name)
	}
	if err != nil && err.Error() != "service not found" {
		// some internal error
		return apierror.InternalError(err)
	}
	// any error here is `service not found`, and we can continue

	// Create the new service. At last.
	_, err = services.CreateService(ctx, cluster, createRequest.Name, org, username, createRequest.Data)
	if err != nil {
		return apierror.InternalError(err)
	}

	response.Created(c)
	return nil
}
