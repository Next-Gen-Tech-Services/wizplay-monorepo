#!/bin/bash

# Wizplay Production Deployment Script
# This script sets up automatic startup of services on server restart

set -e

echo "🚀 Setting up Wizplay production auto-startup..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root (use sudo)"
   exit 1
fi

# Variables
SERVICE_NAME="wizplay-production"
PROJECT_DIR="/var/www/html/wizplay-monorepo"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "📁 Setting up project directory..."
# Get current directory absolute path
CURRENT_DIR=$(pwd)

# Create project directory if it doesn't exist
if [ ! -d "$PROJECT_DIR" ]; then
    mkdir -p "$PROJECT_DIR"
fi

# Copy project files to production directory only if we're not already there
if [ "$CURRENT_DIR" != "$PROJECT_DIR" ]; then
    echo "📋 Copying project files from $CURRENT_DIR to $PROJECT_DIR..."
    cp -r . "$PROJECT_DIR/"
    chown -R root:docker "$PROJECT_DIR"
else
    echo "📋 Already in project directory, skipping copy..."
    chown -R root:docker "$PROJECT_DIR"
fi

echo "🔧 Installing systemd service..."
# Copy the service file
cp "${PROJECT_DIR}/wizplay-production.service" "$SERVICE_FILE"

# Update the service file with correct paths
sed -i "s|/var/www/html/wizplay-monorepo|${PROJECT_DIR}|g" "$SERVICE_FILE"

# Find docker-compose binary location
DOCKER_COMPOSE_PATH=$(which docker-compose)
if [ -z "$DOCKER_COMPOSE_PATH" ]; then
    echo "❌ docker-compose not found in PATH"
    exit 1
fi

# Update the service file with correct docker-compose path
sed -i "s|/usr/local/bin/docker-compose|${DOCKER_COMPOSE_PATH}|g" "$SERVICE_FILE"

echo "🔄 Enabling systemd service..."
# Reload systemd and enable the service
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"

echo "🐳 Enabling Docker to start on boot..."
# Ensure Docker starts on boot
systemctl enable docker

echo "▶️  Starting the service..."
# Start the service now
systemctl start "$SERVICE_NAME"

# Check service status
sleep 5
echo "📊 Service status:"
systemctl status "$SERVICE_NAME" --no-pager -l

echo ""
echo "✅ Setup complete!"
echo ""
echo "🔧 Management commands:"
echo "  • Check status:    sudo systemctl status $SERVICE_NAME"
echo "  • Start services:  sudo systemctl start $SERVICE_NAME"
echo "  • Stop services:   sudo systemctl stop $SERVICE_NAME"
echo "  • Restart:         sudo systemctl restart $SERVICE_NAME"
echo "  • View logs:       sudo journalctl -u $SERVICE_NAME -f"
echo "  • Disable:         sudo systemctl disable $SERVICE_NAME"
echo ""
echo "🚀 Your Wizplay services will now automatically start on server restart!"