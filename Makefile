build-image: ## Build the e2e_image with latest tests version
	docker build -t e2e_image .

cypress-gui: ## Start Cypress in GUI mode, need graphical environment
	yarn --pure-lockfile install
	yarn cypress open

e2e-tests: ## Build e2e_image and fire all the tests
	make build-image fire-tests

fire-tests: ## Fire all Cypress tests
	docker run -e RANCHER_USER=${RANCHER_USER}      \
		-e RANCHER_PASSWORD=${RANCHER_PASSWORD} \
		-e RANCHER_URL=${RANCHER_URL}           \
		-e CLUSTER_NAME=${CLUSTER_NAME}         \
		-e SYSTEM_DOMAIN=${SYSTEM_DOMAIN}       \
		--rm e2e_image cypress.json

install-rancher: ## Install Rancher via Helm
	@./scripts/install_rancher.sh

install-helm: ## Install Helm
	curl --silent --location https://get.helm.sh/helm-v${HELM_VERSION}-linux-amd64.tar.gz | tar xz -C .
	sudo mv linux-amd64/helm /usr/local/bin
	sudo chown root:root /usr/local/bin/helm
	sudo rm -rf linux-amd64/ helm-*.tar.gz

install-k3s: ## Install k3s with default options
	curl -sfL https://get.k3s.io | sh -
	sudo chmod 644 /etc/rancher/k3s/k3s.yaml
	## Wait for k3s to start (could be improved)
	sleep 120

e2e-ci: install-k3s install-helm install-rancher ## Tests

help: ## Show this Makefile's help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
