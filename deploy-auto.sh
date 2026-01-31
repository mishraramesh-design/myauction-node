#!/bin/bash

# Reverse Auction System - Quick Deploy Script for Hostinger
# This script sets up everything automatically

set -e

echo "========================================="
echo "Reverse Auction - Automated Deployment"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Step 1: Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_warning "Running as root. This is fine for initial setup."
else
    print_warning "Not running as root. You may need sudo for some operations."
fi

# Step 2: Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl start docker
    systemctl enable docker
    print_success "Docker installed"
else
    print_success "Docker already installed"
fi

# Step 3: Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    print_success "Docker Compose installed"
else
    print_success "Docker Compose already installed"
fi

# Step 4: Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning "No .env file found. Using default configuration."
    echo "You can edit .env file to customize settings."
else
    print_success ".env file found"
fi

# Step 5: Configure firewall
if command -v ufw &> /dev/null; then
    echo "Configuring firewall..."
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    print_success "Firewall configured"
fi

# Step 6: Create logs directory
mkdir -p ./logs
print_success "Logs directory created"

# Step 7: Stop any existing containers
echo "Stopping existing containers..."
docker-compose down 2>/dev/null || true
print_success "Existing containers stopped"

# Step 8: Build and start containers
echo "Building and starting containers..."
echo "This may take a few minutes..."
docker-compose up -d --build

if [ $? -eq 0 ]; then
    print_success "Containers built and started"
else
    print_error "Failed to start containers"
    exit 1
fi

# Step 9: Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 15

# Step 10: Check container status
echo ""
echo "Container Status:"
docker-compose ps

# Step 11: Check backend health
echo ""
echo "Checking backend health..."
for i in {1..10}; do
    if curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
        print_success "Backend is healthy!"
        break
    else
        echo "Waiting for backend... ($i/10)"
        sleep 3
    fi
done

# Step 12: Display summary
echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Services Running:"
echo "  • Backend API: http://localhost:8001"
echo "  • Frontend: http://localhost:80"
echo "  • Database: External PostgreSQL (93.127.194.188:5432)"
echo ""
echo "Default Admin Login:"
echo "  • Email: admin@reverseauction.com"
echo "  • Password: admin123"
echo "  ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!"
echo ""
echo "Useful Commands:"
echo "  • View logs: docker-compose logs -f"
echo "  • Restart: docker-compose restart"
echo "  • Stop: docker-compose down"
echo "  • Status: docker-compose ps"
echo ""
echo "Database Connection:"
echo "  • Host: 93.127.194.188"
echo "  • Port: 5432"
echo "  • Database: appdb"
echo "  • User: appuser"
echo ""
print_success "Setup completed successfully!"
echo ""
