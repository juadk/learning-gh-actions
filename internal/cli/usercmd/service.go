package usercmd

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"

	apierrors "github.com/epinio/epinio/pkg/api/core/v1/errors"
	"github.com/epinio/epinio/pkg/api/core/v1/models"
)

// Services gets all Epinio services in the targeted org
func (c *EpinioClient) Services() error {
	log := c.Log.WithName("Services").WithValues("Namespace", c.Config.Org)
	log.Info("start")
	defer log.Info("return")
	details := log.V(1) // NOTE: Increment of level, not absolute.

	c.ui.Note().
		WithStringValue("Namespace", c.Config.Org).
		Msg("Listing services")

	if err := c.TargetOk(); err != nil {
		return err
	}

	details.Info("list services")

	response, err := c.API.Services(c.Config.Org)
	if err != nil {
		return err
	}

	details.Info("list services")

	sort.Sort(response)
	msg := c.ui.Success().WithTable("Name", "Applications")

	details.Info("list services")
	for _, service := range response {
		msg = msg.WithTableRow(service.Name, strings.Join(service.BoundApps, ", "))
	}
	msg.Msg("Epinio Services:")

	return nil
}

// ServiceMatching returns all Epinio services having the specified prefix
// in their name.
func (c *EpinioClient) ServiceMatching(ctx context.Context, prefix string) []string {
	log := c.Log.WithName("ServiceMatching").WithValues("PrefixToMatch", prefix)
	log.Info("start")
	defer log.Info("return")
	details := log.V(1) // NOTE: Increment of level, not absolute.

	result := []string{}

	// Ask for all services. Filtering is local.
	// TODO: Create new endpoint (compare `EnvMatch`) and move filtering to the server.

	response, err := c.API.Services(c.Config.Org)
	if err != nil {
		return result
	}

	for _, s := range response {
		service := s.Name
		details.Info("Found", "Name", service)
		if strings.HasPrefix(service, prefix) {
			details.Info("Matched", "Name", service)
			result = append(result, service)
		}
	}

	return result
}

// BindService attaches a service specified by name to the named application,
// both in the targeted organization.
func (c *EpinioClient) BindService(serviceName, appName string) error {
	log := c.Log.WithName("Bind Service To Application").
		WithValues("Name", serviceName, "Application", appName, "Namespace", c.Config.Org)
	log.Info("start")
	defer log.Info("return")

	c.ui.Note().
		WithStringValue("Service", serviceName).
		WithStringValue("Application", appName).
		WithStringValue("Namespace", c.Config.Org).
		Msg("Bind Service")

	if err := c.TargetOk(); err != nil {
		return err
	}

	request := models.BindRequest{
		Names: []string{serviceName},
	}

	br, err := c.API.ServiceBindingCreate(request, c.Config.Org, appName)
	if err != nil {
		return err
	}

	if len(br.WasBound) > 0 {
		c.ui.Success().
			WithStringValue("Service", serviceName).
			WithStringValue("Application", appName).
			WithStringValue("Namespace", c.Config.Org).
			Msg("Service Already Bound to Application.")

		return nil
	}

	c.ui.Success().
		WithStringValue("Service", serviceName).
		WithStringValue("Application", appName).
		WithStringValue("Namespace", c.Config.Org).
		Msg("Service Bound to Application.")
	return nil
}

// UnbindService detaches the service specified by name from the named
// application, both in the targeted organization.
func (c *EpinioClient) UnbindService(serviceName, appName string) error {
	log := c.Log.WithName("Unbind Service").
		WithValues("Name", serviceName, "Application", appName, "Namespace", c.Config.Org)
	log.Info("start")
	defer log.Info("return")

	c.ui.Note().
		WithStringValue("Service", serviceName).
		WithStringValue("Application", appName).
		WithStringValue("Namespace", c.Config.Org).
		Msg("Unbind Service from Application")

	if err := c.TargetOk(); err != nil {
		return err
	}

	_, err := c.API.ServiceBindingDelete(c.Config.Org, appName, serviceName)
	if err != nil {
		return err
	}

	c.ui.Success().
		WithStringValue("Service", serviceName).
		WithStringValue("Application", appName).
		WithStringValue("Namespace", c.Config.Org).
		Msg("Service Detached From Application.")
	return nil
}

// DeleteService deletes a service specified by name
func (c *EpinioClient) DeleteService(name string, unbind bool) error {
	log := c.Log.WithName("Delete Service").
		WithValues("Name", name, "Namespace", c.Config.Org)
	log.Info("start")
	defer log.Info("return")

	c.ui.Note().
		WithStringValue("Name", name).
		WithStringValue("Namespace", c.Config.Org).
		Msg("Delete Service")

	if err := c.TargetOk(); err != nil {
		return err
	}

	request := models.ServiceDeleteRequest{
		Unbind: unbind,
	}

	var bound []string

	_, err := c.API.ServiceDelete(request, c.Config.Org, name,
		func(response *http.Response, bodyBytes []byte, err error) error {
			// nothing special for internal errors and the like
			if response.StatusCode != http.StatusBadRequest {
				return err
			}

			// A bad request happens when the service is
			// still bound to one or more applications,
			// and the response contains an array of their
			// names.

			var apiError apierrors.ErrorResponse
			if err := json.Unmarshal(bodyBytes, &apiError); err != nil {
				return err
			}

			bound = strings.Split(apiError.Errors[0].Details, ",")
			return nil
		})
	if err != nil {
		return err
	}

	if len(bound) > 0 {
		sort.Strings(bound)
		sort.Strings(bound)
		msg := c.ui.Exclamation().WithTable("Bound Applications")

		for _, app := range bound {
			msg = msg.WithTableRow(app)
		}

		msg.Msg("Unable to delete service. It is still used by")
		c.ui.Exclamation().Compact().Msg("Use --unbind to force the issue")

		return nil
	}

	c.ui.Success().
		WithStringValue("Name", name).
		WithStringValue("Namespace", c.Config.Org).
		Msg("Service Removed.")
	return nil
}

// CreateService creates a service specified by name and key/value dictionary
// TODO: Allow underscores in service names (right now they fail because of kubernetes naming rules for secrets)
func (c *EpinioClient) CreateService(name string, dict []string) error {
	log := c.Log.WithName("Create Service").
		WithValues("Name", name, "Namespace", c.Config.Org)
	log.Info("start")
	defer log.Info("return")

	data := make(map[string]string)
	msg := c.ui.Note().
		WithStringValue("Name", name).
		WithStringValue("Namespace", c.Config.Org).
		WithTable("Parameter", "Value", "Access Path")
	for i := 0; i < len(dict); i += 2 {
		key := dict[i]
		value := dict[i+1]
		path := fmt.Sprintf("/services/%s/%s", name, key)
		msg = msg.WithTableRow(key, value, path)
		data[key] = value
	}
	msg.Msg("Create Service")

	if err := c.TargetOk(); err != nil {
		return err
	}

	request := models.ServiceCreateRequest{
		Name: name,
		Data: data,
	}

	_, err := c.API.ServiceCreate(request, c.Config.Org)
	if err != nil {
		return err
	}

	c.ui.Exclamation().
		Msg("Beware, the shown access paths are only available in the application's container")

	c.ui.Success().
		WithStringValue("Name", name).
		WithStringValue("Namespace", c.Config.Org).
		Msg("Service Saved.")
	return nil
}

// ServiceDetails shows the information of a service specified by name
func (c *EpinioClient) ServiceDetails(name string) error {
	log := c.Log.WithName("Service Details").
		WithValues("Name", name, "Namespace", c.Config.Org)
	log.Info("start")
	defer log.Info("return")

	c.ui.Note().
		WithStringValue("Name", name).
		WithStringValue("Namespace", c.Config.Org).
		Msg("Service Details")

	if err := c.TargetOk(); err != nil {
		return err
	}

	resp, err := c.API.ServiceShow(c.Config.Org, name)
	if err != nil {
		return err
	}
	serviceDetails := resp.Details

	c.ui.Note().
		WithStringValue("User", resp.Username).
		Msg("")

	msg := c.ui.Success()

	if len(serviceDetails) > 0 {
		msg = msg.WithTable("Parameter", "Value", "Access Path")

		keys := make([]string, 0, len(serviceDetails))
		for k := range serviceDetails {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			msg = msg.WithTableRow(k, serviceDetails[k],
				fmt.Sprintf("/services/%s/%s", name, k))
		}

		msg.Msg("")
	} else {
		msg.Msg("No parameters")
	}

	c.ui.Exclamation().
		Msg("Beware, the shown access paths are only available in the application's container")
	return nil
}
