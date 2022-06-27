prepare-ci-env: ## Prepare the CI env before installing Epinio
	@./scripts/prepare-ci-env.sh

create-k3d-cluster:
	@./scripts/create-k3d-cluster.sh

install-cert-manager:
	helm repo add cert-manager https://charts.jetstack.io
	helm repo update
	echo "Installing Cert Manager"
	helm upgrade --install cert-manager --create-namespace -n cert-manager \
		--set installCRDs=true \
		--set extraArgs[0]=--enable-certificate-owner-ref=true \
		cert-manager/cert-manager --version 1.7.1 \
		--wait

upgrade-test:
	@./scripts/upgrade-test.sh

help: ## Show this Makefile's help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
