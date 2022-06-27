#!/bin/bash

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
export KUBECONFIG=$SCRIPT_DIR/../tmp/acceptance-kubeconfig

function prepare_system_domain {
  echo -e "\e[32mEPINIO_SYSTEM_DOMAIN not set. Trying to use a magic domain...\e[0m"
  EPINIO_CLUSTER_IP=$(docker inspect k3d-epinio-acceptance-server-0 | jq -r '.[0]["NetworkSettings"]["Networks"]["epinio-acceptance"]["IPAddress"]')
  if [[ -z $EPINIO_CLUSTER_IP ]]; then
    echo "Couldn't find the cluster's IP address"
    exit 1
  fi

  export EPINIO_SYSTEM_DOMAIN="${EPINIO_CLUSTER_IP}.omg.howdoi.website"
  echo -e "Using \e[32m${EPINIO_SYSTEM_DOMAIN}\e[0m for Epinio domain"
}

function create_docker_pull_secret {
	if [[ "$REGISTRY_USERNAME" != "" && "$REGISTRY_PASSWORD" != "" && ! $(kubectl get secret regcred > /dev/null 2>&1) ]];
	then
		kubectl create secret docker-registry regcred \
			--docker-server https://index.docker.io/v1/ \
			--docker-username $REGISTRY_USERNAME \
			--docker-password $REGISTRY_PASSWORD
	fi
}

function get_latest_release() {
  curl --silent "https://api.github.com/repos/epinio/epinio/releases/latest" | sed -n -E '/"tag_name":/s/.*"([^"]+)".*/\1/p'
}

function download_epinio_cli() {
  EPINIO_VERSION=$(get_latest_release epinio)
  wget https://github.com/epinio/epinio/releases/download/${EPINIO_VERSION}/epinio-linux-x86_64
  chmod +x epinio-linux-x86_64
  sudo mv epinio-linux-x86_64 /usr/local/bin/epinio
}

function install_cert_manager() {
	helm repo add cert-manager https://charts.jetstack.io
	helm repo update
	echo "Installing Cert Manager"
	helm upgrade --install cert-manager --create-namespace -n cert-manager \
		--set installCRDs=true \
		--set extraArgs[0]=--enable-certificate-owner-ref=true \
		cert-manager/cert-manager --version 1.7.1 \
		--wait
}

function install_epinio() {
  helm repo add epinio https://epinio.github.io/helm-charts
  kubectl rollout status deployment traefik -n kube-system --timeout=480s
  helm install epinio -n epinio --create-namespace epinio/epinio --set global.domain=${EPINIO_SYSTEM_DOMAIN}
  kubectl rollout status deployment epinio-server -n epinio --timeout=480s
}

function check_app() {
  HTTP_CODE=$(curl -sI --insecure https://testapp.172.18.0.3.omg.howdoi.website |awk '/HTTP/ {print $2}')
  if [[ "$HTTP_CODE" != "200" ]]; then
    echo "The application is not reachable"
    exit 1
  fi


prepare_system_domain
download_epinio_cli
install_cert_manager
install_epinio

epinio login -u admin -p password https://epinio.${EPINIO_SYSTEM_DOMAIN} --trust-ca

# Deploy an app
epinio push -n testapp -p assets/sample-app
check_app

helm upgrade epinio -n epinio chart/epinio --wait
kubectl rollout status deployment epinio-server -n epinio --timeout=480s

check_app

