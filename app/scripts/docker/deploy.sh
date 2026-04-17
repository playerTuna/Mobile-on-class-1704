#!/bin/sh
set -e

if [ -z "$IMAGE_NAME" ]; then
  echo "IMAGE_NAME is required. Example: IMAGE_NAME=myregistry/task-app-backend ./scripts/docker/deploy.sh"
  exit 1
fi

TAG="${TAG:-latest}"

echo "Building image ${IMAGE_NAME}:${TAG}"
docker build -t "${IMAGE_NAME}:${TAG}" .

echo "Pushing image ${IMAGE_NAME}:${TAG}"
docker push "${IMAGE_NAME}:${TAG}"

echo "Deploy artifact published successfully."
