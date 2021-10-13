#!/bin/bash

timeout=240s

# This script should be used while doing development on Epinio.
# When running `epinio install`, the Epinio Deployment will try to apply
# this file: assets/embedded-files/epinio/server.yaml . This file assumes an image
# with the current binary has been built and pushed to Dockerhub. While developing
# though, we don't always build and push such an image so the deployment will fail.
# By setting EPINIO_DONT_WAIT_FOR_DEPLOYMENT we allow the installation to continue
# and by calling `make patch-epinio-deployment` (which calls this script), we
# fix the deployment as this:
# - We use an image that exists (the base image used when building the final image)
# - We create a PVC and a dummy pod that mounts that PVC.
# - We copy the built binary on the PVC by calling `kubectl cp` on the dummy pod.
# - We mount the same PVC on the epinio server deployment at the location where
#   the binary is expected.
# Patching the deployment forces the pod to restart with a now existing image
# and the correct binary is in place.

export EPINIO_BINARY_PATH="${EPINIO_BINARY_PATH:-dist/epinio-linux-amd64}"
export EPINIO_BINARY_TAG="${EPINIO_BINARY_TAG:-$(git describe --tags --abbrev=0)}"

echo
echo Configuration
echo "  - Binary: ${EPINIO_BINARY_PATH}"
echo "  - Tag:    ${EPINIO_BINARY_TAG}"
echo

if [ ! -f "$EPINIO_BINARY_PATH" ]; then
  echo "epinio binary path is not a file"
  exit 1
fi

if [ -z "$EPINIO_BINARY_TAG" ]; then
  echo "epinio binary tag is empty"
  exit 1
fi

echo "Creating the PVC"
cat <<EOF | kubectl apply -f -
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: epinio-binary
  namespace: epinio
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Mi
EOF

echo "Creating the dummy copier Pod"
cat <<EOF | kubectl apply -f -
---
apiVersion: v1
kind: Pod
metadata:
  name: epinio-copier
  namespace: epinio
  annotations:
    linkerd.io/inject: disabled
spec:
  volumes:
    - name: epinio-binary
      persistentVolumeClaim:
        claimName: epinio-binary
  containers:
    - name: copier
      image: busybox:stable
      command: ["/bin/sh", "-ec", "while :; do printf '.'; sleep 5 ; done"]
      volumeMounts:
        - mountPath: "/epinio"
          name: epinio-binary
EOF

echo "Waiting for dummy pod to be ready"
kubectl wait --for=condition=ready --timeout=$timeout pod -n epinio epinio-copier

echo "Copying the binary on the PVC"
# Notes
# 1. kubectl cp breaks because of the colon in `pod:path`. Thus the more complex tar construction.
# 2. Cannot use absolute paths, i.e. `/foo`. This is a disk-relative path on Windows, and gets
#    expanded weirdly by the kubectl commands.
#    Relative paths are ok, as the default CWD in the container is the root (`/`).
#    I.e. `foo` is `/foo` pod-side.

( cd       "$(dirname  "${EPINIO_BINARY_PATH}")"
  tar cf - "$(basename "${EPINIO_BINARY_PATH}")"
) | kubectl exec -i -n epinio -c copier epinio-copier -- tar xf -
kubectl exec -i -n epinio -c copier epinio-copier -- mv "$(basename "${EPINIO_BINARY_PATH}")" epinio/epinio
kubectl exec -i -n epinio -c copier epinio-copier -- chmod ugo+x epinio/epinio
kubectl exec -i -n epinio -c copier epinio-copier -- ls -l epinio

echo "Patching the epinio-server deployment to use the copied binary"
read -r -d '' PATCH <<EOF
{
  "spec": { "template": {
      "spec": {
        "volumes": [
          {
            "name":"epinio-binary",
            "persistentVolumeClaim": {
              "claimName": "epinio-binary"
            }
          }
        ],
        "containers": [{
          "name": "epinio-server",
          "image": "splatform/epinio-base:${EPINIO_BINARY_TAG}",
          "command": [
            "/epinio-binary/epinio",
            "server"
          ],
          "volumeMounts": [
            {
              "name": "epinio-binary",
              "mountPath": "/epinio-binary"
            }
          ]
        }]
      }
    }
  }
}
EOF
kubectl patch deployment -n epinio epinio-server -p "${PATCH}"


echo "Ensuring the deployment is restarted"
kubectl rollout restart deployment -n epinio epinio-server

# https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#-em-status-em-
echo "Waiting for the rollout of the deployment to complete"
kubectl rollout status deployment -n epinio epinio-server  --timeout=$timeout