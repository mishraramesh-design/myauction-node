# Reverse Auction System - Hostinger Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Hostinger VPS Setup](#hostinger-vps-setup)
3. [Docker Installation](#docker-installation)
4. [Application Deployment](#application-deployment)
5. [Database Setup](#database-setup)
6. [SSL Certificate Setup](#ssl-certificate-setup)
7. [Maintenance](#maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### What You Need:
- Hostinger VPS (minimum 2GB RAM recommended)
- Domain name pointed to your VPS IP
- Basic SSH knowledge
- Your application code

### Recommended Hostinger VPS Plan:
- **VPS 1 or VPS 2**: For development/testing
- **VPS 3 or higher**: For production with multiple users

---

## Step 1: Hostinger VPS Setup

### 1.1 Access Your VPS

```bash
# Connect via SSH
ssh root@your-vps-ip-address

# Or use Hostinger's built-in terminal in hPanel
```

### 1.2 Update System

```bash
# Update package list
apt update && apt upgrade -y

# Install essential packages
apt install -y curl wget git nano ufw
```

### 1.3 Configure Firewall

```bash
# Allow SSH
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow PostgreSQL (if accessing externally)
ufw allow 5432/tcp

# Enable firewall
ufw enable
```

---

## Step 2: Docker Installation

### 2.1 Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Start Docker service
systemctl start docker
systemctl enable docker

# Verify installation
docker --version
```

### 2.2 Install Docker Compose

```bash
# Download Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make it executable
chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

---

## Step 3: Application Deployment

### 3.1 Upload Application Code

**Option A: Using Git (Recommended)**

```bash
# Clone your repository
cd /var/www
git clone https://github.com/yourusername/reverse-auction.git
cd reverse-auction
```

**Option B: Using SCP/SFTP**

```bash
# From your local machine
scp -r /path/to/your/app root@your-vps-ip:/var/www/reverse-auction
```

**Option C: Using Hostinger File Manager**
- Upload your application files through hPanel File Manager
- Extract to `/var/www/reverse-auction`

### 3.2 Configure Environment Variables

```bash
cd /var/www/reverse-auction

# Copy and edit environment file
cp .env.production .env
nano .env
```

**Update the following in `.env`:**

```bash
# Database Configuration
DB_NAME=auction_db
DB_USER=auction_admin
DB_PASSWORD=YOUR_STRONG_PASSWORD_HERE

# Backend Configuration
JWT_SECRET=your-random-jwt-secret-min-32-chars-abc123xyz789
ENCRYPTION_KEY=your-32-char-encryption-key-12
MAX_ITEMS_PER_TENDER=2
CORS_ORIGINS=https://yourdomain.com

# Frontend Configuration
BACKEND_URL=https://yourdomain.com
REACT_APP_BACKEND_URL=https://yourdomain.com
```

**Generate Secure Keys:**

```bash
# Generate JWT Secret (32+ characters)
openssl rand -base64 32

# Generate Encryption Key (exactly 32 characters)
openssl rand -hex 16
```

### 3.3 Build and Deploy with Docker

```bash
cd /var/www/reverse-auction

# Build and start containers
docker-compose up -d --build

# Check container status
docker-compose ps

# View logs
docker-compose logs -f
```

---

## Step 4: Database Setup

### 4.1 Verify PostgreSQL Container

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres
```

### 4.2 Access PostgreSQL (Optional - for manual setup)

```bash
# Connect to PostgreSQL container
docker exec -it reverse_auction_db psql -U postgres -d auction_db

# Or from host machine
docker exec -i reverse_auction_db psql -U postgres -d auction_db < database/schema.sql
```

### 4.3 Verify Database Schema

```bash
# List all tables
docker exec -it reverse_auction_db psql -U postgres -d auction_db -c "\\dt"

# Check default admin user
docker exec -it reverse_auction_db psql -U postgres -d auction_db -c "SELECT email, role FROM users WHERE role='admin';"
```

**Default Admin Credentials:**
- Email: `admin@reverseauction.com`
- Password: `admin123`
- **⚠️ IMPORTANT: Change this password immediately after first login!**

### 4.4 Backup Database (Important!)

```bash
# Create backup directory
mkdir -p /var/backups/postgres

# Create backup script
cat > /var/backups/postgres/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec reverse_auction_db pg_dump -U postgres auction_db > /var/backups/postgres/auction_db_$DATE.sql
# Keep only last 7 days
find /var/backups/postgres -name "*.sql" -mtime +7 -delete
EOF

chmod +x /var/backups/postgres/backup.sh

# Schedule daily backup (3 AM)
(crontab -l 2>/dev/null; echo "0 3 * * * /var/backups/postgres/backup.sh") | crontab -
```

---

## Step 5: SSL Certificate Setup (HTTPS)

### 5.1 Install Certbot

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx
```

### 5.2 Update Nginx Configuration for SSL

```bash
# Stop containers temporarily
docker-compose down

# Get SSL certificate
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Update nginx.conf
nano nginx.conf
```

**Add SSL configuration to `nginx.conf`:**

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    root /usr/share/nginx/html;
    index index.html;

    # Rest of your nginx configuration...
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://backend:8001/api/;
        # ... (rest of proxy config)
    }
}
```

### 5.3 Update Docker Compose for SSL

```bash
nano docker-compose.yml
```

**Update frontend service:**

```yaml
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: reverse_auction_frontend
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro  # Add this line
    depends_on:
      - backend
    networks:
      - auction_network
```

### 5.4 Restart Containers

```bash
# Rebuild and restart
docker-compose up -d --build

# Auto-renew SSL certificate
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
```

---

## Step 6: Domain Configuration

### 6.1 Update DNS Records (in Hostinger hPanel)

1. Go to **Domains** → Select your domain → **DNS Zone**
2. Add/Update A Records:
   ```
   Type: A
   Name: @ (or your domain)
   Points to: YOUR_VPS_IP_ADDRESS
   TTL: 14400
   
   Type: A
   Name: www
   Points to: YOUR_VPS_IP_ADDRESS
   TTL: 14400
   ```

3. Wait 10-30 minutes for DNS propagation

---

## Step 7: Verify Deployment

### 7.1 Check Application Status

```bash
# Check all containers
docker-compose ps

# Check logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres
```

### 7.2 Test Endpoints

```bash
# Test backend health
curl https://yourdomain.com/api/health

# Test database connection
docker exec reverse_auction_backend node -e "
const pool = require('./config/database');
pool.query('SELECT NOW()', (err, res) => {
  console.log(err ? 'DB Error' : 'DB Connected');
  pool.end();
});
"
```

### 7.3 Access Application

1. Open browser: `https://yourdomain.com`
2. Login with default admin credentials
3. **Change admin password immediately!**

---

## Step 8: Post-Deployment Security

### 8.1 Change Default Passwords

```bash
# Change admin password in application UI
# Or via database
docker exec -it reverse_auction_db psql -U postgres -d auction_db

# Generate new password hash (replace 'NewPassword123')
# Use bcrypt online generator or Node.js:
node -e "console.log(require('bcryptjs').hashSync('NewPassword123', 10))"

# Update in database
UPDATE users SET password_hash = 'YOUR_NEW_HASH' WHERE email = 'admin@reverseauction.com';
```

### 8.2 Secure PostgreSQL

```bash
# Change PostgreSQL password
docker exec -it reverse_auction_db psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'new_strong_password';"

# Update .env file
nano .env
# Update DB_PASSWORD=new_strong_password

# Restart containers
docker-compose down && docker-compose up -d
```

### 8.3 Enable Fail2Ban (Prevent Brute Force)

```bash
apt install -y fail2ban

# Configure
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 3600
EOF

systemctl restart fail2ban
```

---

## Step 9: Maintenance Commands

### 9.1 Container Management

```bash
# View logs
docker-compose logs -f [service_name]

# Restart specific service
docker-compose restart backend

# Restart all services
docker-compose restart

# Stop all services
docker-compose down

# Start all services
docker-compose up -d

# Rebuild after code changes
docker-compose up -d --build
```

### 9.2 Database Management

```bash
# Backup database
docker exec reverse_auction_db pg_dump -U postgres auction_db > backup_$(date +%Y%m%d).sql

# Restore database
docker exec -i reverse_auction_db psql -U postgres auction_db < backup_20260131.sql

# Access PostgreSQL CLI
docker exec -it reverse_auction_db psql -U postgres -d auction_db
```

### 9.3 Update Application

```bash
cd /var/www/reverse-auction

# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Verify
docker-compose ps
```

### 9.4 Monitor Resources

```bash
# Check disk usage
df -h

# Check memory
free -h

# Check Docker resource usage
docker stats

# Check logs size
du -sh /var/lib/docker/containers/*

# Clean up old Docker data
docker system prune -a
```

---

## Step 10: Troubleshooting

### Common Issues and Solutions

**Issue 1: Container won't start**
```bash
# Check logs
docker-compose logs [service_name]

# Check port conflicts
netstat -tulpn | grep :8001
netstat -tulpn | grep :80

# Kill conflicting process
kill $(lsof -ti:8001)
```

**Issue 2: Database connection failed**
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test connection
docker exec reverse_auction_backend node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()').then(r => console.log('OK')).catch(e => console.log('Error:', e.message));
"
```

**Issue 3: Frontend can't reach backend**
```bash
# Check nginx logs
docker-compose logs frontend

# Verify backend is accessible
docker exec reverse_auction_frontend wget -O- http://backend:8001/api/health

# Check CORS settings
grep CORS_ORIGINS .env
```

**Issue 4: SSL certificate issues**
```bash
# Renew certificate
certbot renew --force-renewal

# Check certificate
certbot certificates

# Restart nginx
docker-compose restart frontend
```

---

## Configuration Files Reference

### Required Files Structure:
```
/var/www/reverse-auction/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── config/
│   ├── routes/
│   ├── middleware/
│   └── utils/
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── database/
│   └── schema.sql
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
├── nginx.conf
└── .env
```

---

## Performance Optimization

### 1. Enable Redis Caching (Optional)

```yaml
# Add to docker-compose.yml
  redis:
    image: redis:alpine
    container_name: reverse_auction_redis
    restart: always
    ports:
      - "6379:6379"
    networks:
      - auction_network
```

### 2. Configure Nginx Caching

```nginx
# Add to nginx.conf
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    # ... rest of config
}
```

### 3. Database Optimization

```sql
-- Run these in PostgreSQL
-- Vacuum and analyze
VACUUM ANALYZE;

-- Create additional indexes if needed
CREATE INDEX CONCURRENTLY idx_tenders_dates ON tenders(techno_closing_date, financial_bidding_end);
```

---

## Monitoring Setup (Optional)

### Install monitoring tools:

```bash
# Install htop for resource monitoring
apt install -y htop

# Install ctop for Docker monitoring
wget https://github.com/bcicen/ctop/releases/download/v0.7.7/ctop-0.7.7-linux-amd64 -O /usr/local/bin/ctop
chmod +x /usr/local/bin/ctop

# Usage
htop
ctop
```

---

## Support & Documentation

### Useful Commands Cheat Sheet:

```bash
# Quick health check
docker-compose ps && curl -s http://localhost:8001/api/health | jq

# View all logs
docker-compose logs -f --tail=100

# Backup everything
tar -czf backup_$(date +%Y%m%d).tar.gz /var/www/reverse-auction

# Check application size
du -sh /var/www/reverse-auction

# Update system
apt update && apt upgrade -y && docker-compose pull && docker-compose up -d
```

---

## Emergency Procedures

### If site goes down:

```bash
# 1. Check container status
docker-compose ps

# 2. Restart all services
docker-compose restart

# 3. Check logs for errors
docker-compose logs --tail=50

# 4. If still down, restore from backup
docker-compose down
# Restore database
docker-compose up -d postgres
docker exec -i reverse_auction_db psql -U postgres auction_db < /var/backups/postgres/latest_backup.sql
# Restart all
docker-compose up -d
```

---

## Conclusion

Your Reverse Auction System is now deployed on Hostinger VPS with Docker!

**Important Next Steps:**
1. ✅ Change default admin password
2. ✅ Set up automated backups
3. ✅ Monitor application logs regularly
4. ✅ Keep Docker images updated
5. ✅ Test bid submission workflows

**For Support:**
- Check logs: `docker-compose logs`
- PostgreSQL console: `docker exec -it reverse_auction_db psql -U postgres auction_db`
- Application files: `/var/www/reverse-auction`

**Security Checklist:**
- [ ] Changed default admin password
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Strong database password set
- [ ] Automated backups running
- [ ] Monitoring enabled

---

*Deployment Guide Version 2.0*
*Last Updated: January 2026*
