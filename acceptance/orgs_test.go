package acceptance_test

import (
	"fmt"

	"github.com/epinio/epinio/acceptance/helpers/catalog"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("Namespaces", func() {
	It("has a default namespace", func() {
		namespaceNames, err := env.Epinio("", "namespace", "list")
		Expect(err).ToNot(HaveOccurred())
		Expect(namespaceNames).To(MatchRegexp("workspace"))
	})

	Describe("namespace create", func() {
		It("creates and targets an namespace", func() {
			namespaceName := catalog.NewOrgName()
			env.SetupAndTargetOrg(namespaceName)

			By("switching namespace back to default")
			out, err := env.Epinio("", "target", "workspace")
			Expect(err).ToNot(HaveOccurred(), out)
		})

		It("rejects creating an existing namespace", func() {
			namespaceName := catalog.NewOrgName()
			env.SetupAndTargetOrg(namespaceName)

			out, err := env.Epinio("", "namespace", "create", namespaceName)
			Expect(err).To(HaveOccurred(), out)

			Expect(out).To(MatchRegexp(fmt.Sprintf("Namespace '%s' already exists", namespaceName)))
		})
	})

	Describe("namespace list", func() {
		var namespaceName string
		var serviceName string
		var appName string

		BeforeEach(func() {
			namespaceName = catalog.NewOrgName()
			env.SetupAndTargetOrg(namespaceName)

			serviceName = catalog.NewServiceName()
			env.MakeService(serviceName)

			appName = catalog.NewAppName()
			out, err := env.Epinio("", "app", "create", appName)
			Expect(err).ToNot(HaveOccurred(), out)
			Expect(out).To(MatchRegexp("Ok"))
		})

		It("lists namespaces", func() {
			out, err := env.Epinio("", "namespace", "list", namespaceName)

			Expect(err).ToNot(HaveOccurred(), out)
			Expect(out).To(MatchRegexp(fmt.Sprintf(`%s.* \| .*%s.* \| .*%s`, namespaceName, appName, serviceName)))
		})
	})

	Describe("namespace show", func() {
		It("rejects showing an unknown namespace", func() {
			out, err := env.Epinio("", "namespace", "show", "missing-namespace")
			Expect(err).To(HaveOccurred(), out)

			Expect(out).To(MatchRegexp("namespace 'missing-namespace' does not exist"))
		})

		Context("existing namespace", func() {
			var namespaceName string
			var serviceName string
			var appName string

			BeforeEach(func() {
				namespaceName = catalog.NewOrgName()
				env.SetupAndTargetOrg(namespaceName)

				serviceName = catalog.NewServiceName()
				env.MakeService(serviceName)

				appName = catalog.NewAppName()
				out, err := env.Epinio("", "app", "create", appName)
				Expect(err).ToNot(HaveOccurred(), out)
				Expect(out).To(MatchRegexp("Ok"))
			})

			It("shows a namespace", func() {
				out, err := env.Epinio("", "namespace", "show", namespaceName)

				Expect(err).ToNot(HaveOccurred(), out)
				Expect(out).To(MatchRegexp(fmt.Sprintf(`Name .*\| .*%s`, namespaceName)))
				Expect(out).To(MatchRegexp(fmt.Sprintf(`Services .*\| .*%s`, serviceName)))
				Expect(out).To(MatchRegexp(fmt.Sprintf(`Applications .*\| .*%s`, appName)))
			})
		})
	})

	Describe("namespace delete", func() {
		It("deletes an namespace", func() {
			namespaceName := catalog.NewOrgName()
			env.SetupAndTargetOrg(namespaceName)

			By("deleting namespace")
			out, err := env.Epinio("", "namespace", "delete", "-f", namespaceName)

			Expect(err).ToNot(HaveOccurred(), out)
		})
	})
})
