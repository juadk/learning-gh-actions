#!/bin/bash

set -e

# Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm upgrade --install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --set installCRDs=true --set extraArgs[0]=--enable-certificate-owner-ref=true

# Set localhost to domain
sed -i 's/domain: ""/domain: "localhost"/g' chart/epinio/values.yaml 

# Create namespace epinio (hardcoded)
kubectl create ns epinio
