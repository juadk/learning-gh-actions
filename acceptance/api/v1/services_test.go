package v1_test

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"github.com/epinio/epinio/acceptance/helpers/catalog"
	"github.com/epinio/epinio/pkg/api/core/v1/models"
	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("Services API Application Endpoints", func() {
	var org string
	var svc1, svc2 string

	BeforeEach(func() {
		org = catalog.NewOrgName()
		env.SetupAndTargetOrg(org)

		svc1 = catalog.NewServiceName()
		svc2 = catalog.NewServiceName()

		env.MakeService(svc1)
		env.MakeService(svc2)
	})

	AfterEach(func() {
		env.DeleteService(svc1)
		env.DeleteService(svc2)
	})

	Describe("GET /api/v1/namespaces/:org/services", func() {
		var serviceNames []string

		It("lists all services in the org", func() {
			response, err := env.Curl("GET", fmt.Sprintf("%s/api/v1/namespaces/%s/services",
				serverURL, org), strings.NewReader(""))
			Expect(err).ToNot(HaveOccurred())
			Expect(response).ToNot(BeNil())
			defer response.Body.Close()
			bodyBytes, err := ioutil.ReadAll(response.Body)
			Expect(err).ToNot(HaveOccurred())
			Expect(response.StatusCode).To(Equal(http.StatusOK), string(bodyBytes))

			var data models.ServiceResponseList
			err = json.Unmarshal(bodyBytes, &data)
			Expect(err).ToNot(HaveOccurred())
			serviceNames = append(serviceNames, data[0].Name)
			serviceNames = append(serviceNames, data[1].Name)
			Expect(serviceNames).Should(ContainElements(svc1, svc2))
		})

		It("returns a 404 when the org does not exist", func() {
			response, err := env.Curl("GET", fmt.Sprintf("%s/api/v1/namespaces/idontexist/services", serverURL), strings.NewReader(""))
			Expect(err).ToNot(HaveOccurred())
			Expect(response).ToNot(BeNil())

			defer response.Body.Close()
			bodyBytes, err := ioutil.ReadAll(response.Body)
			Expect(err).ToNot(HaveOccurred())
			Expect(response.StatusCode).To(Equal(http.StatusNotFound), string(bodyBytes))
		})
	})

	Describe("GET api/v1/namespaces/:org/services/:service", func() {
		It("lists the service data", func() {
			response, err := env.Curl("GET", fmt.Sprintf("%s/api/v1/namespaces/%s/services/%s", serverURL, org, svc1), strings.NewReader(""))
			Expect(err).ToNot(HaveOccurred())
			Expect(response).ToNot(BeNil())
			defer response.Body.Close()
			Expect(response.StatusCode).To(Equal(http.StatusOK))
			bodyBytes, err := ioutil.ReadAll(response.Body)
			Expect(err).ToNot(HaveOccurred())

			var data models.ServiceShowResponse
			err = json.Unmarshal(bodyBytes, &data)
			service := data.Details
			Expect(err).ToNot(HaveOccurred())
			Expect(service["username"]).To(Equal("epinio-user"))
		})

		It("returns a 404 when the org does not exist", func() {
			response, err := env.Curl("GET", fmt.Sprintf("%s/api/v1/namespaces/idontexist/services/%s", serverURL, svc1), strings.NewReader(""))
			Expect(err).ToNot(HaveOccurred())
			Expect(response).ToNot(BeNil())

			defer response.Body.Close()
			bodyBytes, err := ioutil.ReadAll(response.Body)
			Expect(err).ToNot(HaveOccurred())
			Expect(response.StatusCode).To(Equal(http.StatusNotFound), string(bodyBytes))
		})

		It("returns a 404 when the service does not exist", func() {
			response, err := env.Curl("GET", fmt.Sprintf("%s/api/v1/namespaces/%s/services/bogus", serverURL, org), strings.NewReader(""))
			Expect(err).ToNot(HaveOccurred())
			Expect(response).ToNot(BeNil())

			defer response.Body.Close()
			bodyBytes, err := ioutil.ReadAll(response.Body)
			Expect(err).ToNot(HaveOccurred())
			Expect(response.StatusCode).To(Equal(http.StatusNotFound), string(bodyBytes))
		})
	})
})
