#!/bin/bash

set -e

# Add stable Rancher Helm chart repo
helm repo add rancher-stable https://releases.rancher.com/server-charts/stable

# Cert Manager has to be installed before Rancher
kubectl apply -f https://github.com/jetstack/cert-manager/releases/download/v1.5.1/cert-manager.crds.yaml
kubectl create namespace cattle-system
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --version v1.5.1

# Wait for cert-manager deployment to be ready
kubectl rollout status deployment cert-manager -n cert-manager --timeout=120s

# Install Rancher
helm install rancher rancher-stable/rancher --namespace cattle-system \
 --set hostname=${MY_HOSTNAME} \
 --set bootstrapPassword=rancherpassword \
 --set "extraEnv[0].name=CATTLE_UI_DASHBOARD_INDEX" \
 --set "extraEnv[0].value=https://releases.rancher.com/dashboard/${DASHBOARD_VERSION}/index.html" \
 --set "extraEnv[1].name=CATTLE_UI_OFFLINE_PREFERRED" \
 --set "extraEnv[1].value=Remote"

# Wait for rancher deployment to be ready
kubectl rollout status deployment rancher -n cattle-system --timeout=300s
