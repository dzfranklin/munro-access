#!/bin/bash
set -e

# Configuration
IMAGE_NAME="munro-access"
APP_DIR="/home/app/munro-access"
CONTAINER_FILE="munro-access.container"

# Set up environment for systemd user services
# Required when using 'sudo su app' instead of proper login
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"

echo "=== Munro Access Deployment ==="
echo "Working directory: $APP_DIR"

# Check if lingering is enabled
if ! loginctl show-user "$(whoami)" -p Linger | grep -q "Linger=yes"; then
    echo "ERROR: User lingering is not enabled for $(whoami)"
    echo "Run this as a sudoer user: sudo loginctl enable-linger app"
    exit 1
fi

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

# Reload systemd to regenerate service from .container file
echo "Reloading systemd daemon..."
systemctl --user daemon-reload

# Stop existing service if running
echo "Stopping existing service..."
systemctl --user stop munro-access.service 2>/dev/null || true

# Start the service (Quadlet services are auto-enabled via .container file)
echo "Starting service..."
systemctl --user start munro-access.service

# Show status
echo "=== Deployment Complete ==="
systemctl --user status munro-access.service --no-pager

echo ""
echo "Application is running on port 3000"
echo "Configure your reverse proxy to forward to localhost:3000"
