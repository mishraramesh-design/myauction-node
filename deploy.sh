#!/bin/bash

# Reverse Auction System - Quick Deploy Script for Hostinger VPS
# This script automates the deployment process

set -e  # Exit on error

echo "=========================================="
echo "Reverse Auction System - Quick Deploy"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use: sudo bash deploy.sh)"
    exit 1
fi

print_success "Running as root"

# Step 1: System Update
echo ""
echo "Step 1: Updating system packages..."
apt update && apt upgrade -y
apt install -y curl wget git nano ufw
print_success "System updated"

# Step 2: Install Docker
echo ""
echo "Step 2: Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl start docker
    systemctl enable docker
    print_success "Docker installed"
else
    print_warning "Docker already installed"
fi

# Step 3: Install Docker Compose
echo ""
echo "Step 3: Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    print_success "Docker Compose installed"
else
    print_warning "Docker Compose already installed"
fi

# Step 4: Configure Firewall
echo ""
echo "Step 4: Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
print_success "Firewall configured"

# Step 5: Get application directory
echo ""
read -p "Enter application directory path [/var/www/reverse-auction]: " APP_DIR
APP_DIR=${APP_DIR:-/var/www/reverse-auction}

if [ ! -d "$APP_DIR" ]; then
    print_error "Directory $APP_DIR does not exist"
    read -p "Do you want to create it and clone from Git? (y/n): " CLONE_GIT
    if [ "$CLONE_GIT" == "y" ]; then
        read -p "Enter Git repository URL: " GIT_REPO
        mkdir -p $(dirname "$APP_DIR")
        git clone "$GIT_REPO" "$APP_DIR"
        print_success "Repository cloned"
    else
        print_error "Please upload your application files to $APP_DIR first"
        exit 1
    fi
fi

cd "$APP_DIR"
print_success "Changed to application directory: $APP_DIR"

# Step 6: Environment Configuration
echo ""
echo "Step 6: Configuring environment variables..."
if [ ! -f ".env" ]; then
    if [ -f ".env.production" ]; then
        cp .env.production .env
    else
        print_error ".env.production template not found"
        exit 1
    fi
fi

# Generate secure keys
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -hex 16)
DB_PASSWORD=$(openssl rand -base64 16)

# Get domain name
read -p "Enter your domain name (e.g., example.com): " DOMAIN_NAME

# Update .env file
sed -i "s|DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" .env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION_KEY|" .env
sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=https://$DOMAIN_NAME|" .env
sed -i "s|BACKEND_URL=.*|BACKEND_URL=https://$DOMAIN_NAME|" .env
sed -i "s|REACT_APP_BACKEND_URL=.*|REACT_APP_BACKEND_URL=https://$DOMAIN_NAME|" .env

print_success "Environment configured"
echo ""
print_warning "Database Password: $DB_PASSWORD"
print_warning "Please save these credentials securely!"
echo ""

# Step 7: Deploy with Docker
echo ""
echo "Step 7: Building and deploying containers..."
docker-compose down 2>/dev/null || true
docker-compose up -d --build

# Wait for services to start
echo "Waiting for services to start..."
sleep 10

# Check container status
docker-compose ps

print_success "Containers deployed"

# Step 8: Verify Database
echo ""
echo "Step 8: Verifying database..."
if docker exec reverse_auction_db psql -U postgres -d auction_db -c "SELECT 1" > /dev/null 2>&1; then
    print_success "Database is healthy"
else
    print_error "Database connection failed"
fi

# Step 9: Setup Backup
echo ""
echo "Step 9: Setting up automated backups..."
mkdir -p /var/backups/postgres

cat > /var/backups/postgres/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec reverse_auction_db pg_dump -U postgres auction_db > /var/backups/postgres/auction_db_$DATE.sql
find /var/backups/postgres -name "*.sql" -mtime +7 -delete
EOF

chmod +x /var/backups/postgres/backup.sh

# Add to crontab if not exists
(crontab -l 2>/dev/null | grep -q backup.sh) || (crontab -l 2>/dev/null; echo "0 3 * * * /var/backups/postgres/backup.sh") | crontab -

print_success "Backup script configured (runs daily at 3 AM)"

# Step 10: SSL Certificate Setup
echo ""
read -p "Do you want to setup SSL certificate with Let's Encrypt? (y/n): " SETUP_SSL

if [ "$SETUP_SSL" == "y" ]; then
    apt install -y certbot python3-certbot-nginx
    
    print_warning "Stopping containers to obtain certificate..."
    docker-compose down
    
    certbot certonly --standalone -d "$DOMAIN_NAME" -d "www.$DOMAIN_NAME" --non-interactive --agree-tos --email "admin@$DOMAIN_NAME"
    
    if [ $? -eq 0 ]; then
        print_success "SSL certificate obtained"
        
        # Update nginx.conf with SSL
        print_warning "Please update nginx.conf with SSL configuration manually"
        print_warning "Certificate location: /etc/letsencrypt/live/$DOMAIN_NAME/"
        
        # Add auto-renewal
        (crontab -l 2>/dev/null | grep -q certbot) || (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
        
        docker-compose up -d
    else
        print_error "SSL certificate setup failed"
        docker-compose up -d
    fi
fi

# Final Summary
echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Application Details:"
echo "  • Directory: $APP_DIR"
echo "  • Domain: https://$DOMAIN_NAME"
echo "  • Database: auction_db"
echo ""
echo "Default Admin Login:"
echo "  • Email: admin@reverseauction.com"
echo "  • Password: admin123"
echo "  ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!"
echo ""
echo "Important Files:"
echo "  • Environment: $APP_DIR/.env"
echo "  • Logs: /var/log/supervisor/"
echo "  • Backups: /var/backups/postgres/"
echo ""
echo "Useful Commands:"
echo "  • View logs: docker-compose logs -f"
echo "  • Restart: docker-compose restart"
echo "  • Stop: docker-compose down"
echo "  • Status: docker-compose ps"
echo ""
echo "Next Steps:"
echo "  1. Access https://$DOMAIN_NAME and login"
echo "  2. Change admin password"
echo "  3. Configure system settings"
echo "  4. Test tender creation and bidding"
echo ""
print_success "Deployment script completed!"
echo ""
