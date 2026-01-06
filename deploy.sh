#!/bin/bash
set -e

# Configuration
IMAGE_NAME="munro-access"
APP_DIR="/home/app/munro-access"
CONTAINER_FILE="munro-access.container"

echo "=== Munro Access Deployment ==="
echo "Working directory: $APP_DIR"

# Navigate to app directory
cd "$APP_DIR"

# Pull latest code
echo "Pulling latest code..."
git pull

# Build the image
echo "Building container image..."
podman build -t "$IMAGE_NAME:latest" .

# Copy container file to systemd user directory
echo "Installing systemd service..."
mkdir -p ~/.config/containers/systemd
cp "$CONTAINER_FILE" ~/.config/containers/systemd/

# Reload systemd and restart service
echo "Reloading systemd daemon..."
systemctl --user daemon-reload

echo "Restarting service..."
systemctl --user restart munro-access.service

# Enable service if not already enabled
systemctl --user enable munro-access.service

# Show status
echo "=== Deployment Complete ==="
systemctl --user status munro-access.service --no-pager

echo ""
echo "Application is running on port 3000"
echo "Configure your reverse proxy to forward to localhost:3000"
