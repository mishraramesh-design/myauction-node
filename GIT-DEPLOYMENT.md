# Git Deployment Instructions

## Step-by-Step: Deploy to Git and Run on Hostinger

### Part 1: Push to GitHub

#### 1. Initialize Git Repository (if not already done)
```bash
cd /app
git init
git add .
git commit -m "Initial commit - Reverse Auction System with external PostgreSQL"
```

#### 2. Create GitHub Repository
- Go to https://github.com/new
- Create a new repository (e.g., `reverse-auction-system`)
- Do NOT initialize with README (we already have files)

#### 3. Push to GitHub
```bash
# Add remote origin (replace with your repository URL)
git remote add origin https://github.com/YOUR_USERNAME/reverse-auction-system.git

# Push to main branch
git branch -M main
git push -u origin main
```

---

### Part 2: Deploy on Hostinger VPS

#### Method 1: One-Command Automated Deployment (Recommended)

**On your Hostinger VPS:**

```bash
# 1. SSH into Hostinger VPS
ssh root@your-hostinger-ip

# 2. Clone repository
cd /var/www
git clone https://github.com/YOUR_USERNAME/reverse-auction-system.git
cd reverse-auction-system

# 3. Run automated deployment
sudo bash deploy-auto.sh
```

**That's it! The script will:**
- ✅ Install Docker & Docker Compose
- ✅ Configure firewall
- ✅ Build all containers
- ✅ Connect to external PostgreSQL (93.127.194.188:5432)
- ✅ Create database schema automatically
- ✅ Start all services

#### Method 2: Manual Deployment

```bash
# 1. Clone repository
cd /var/www
git clone https://github.com/YOUR_USERNAME/reverse-auction-system.git
cd reverse-auction-system

# 2. Make scripts executable
chmod +x deploy-auto.sh backend/entrypoint.sh

# 3. Review and edit .env if needed
nano .env

# 4. Build and start with Docker Compose
docker-compose up -d --build

# 5. Check status
docker-compose ps
docker-compose logs -f
```

---

### Part 3: Verify Deployment

```bash
# Check backend health
curl http://localhost:8001/api/health

# Check frontend
curl http://localhost:80

# View logs
docker-compose logs -f backend

# Check database connection
docker exec reverse_auction_backend node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://appuser:apppassword@93.127.194.188:5432/appdb' });
pool.query('SELECT NOW()').then(r => console.log('✓ DB Connected')).catch(e => console.log('✗ Error:', e.message));
"
```

---

### Part 4: Access Application

1. **Open browser:** `http://your-hostinger-ip`
2. **Login with:**
   - Email: `admin@reverseauction.com`
   - Password: `admin123`
3. **⚠️ CHANGE PASSWORD IMMEDIATELY!**

---

## Configuration Details

### External PostgreSQL Database

Your application automatically connects to:
```
Host: 93.127.194.188
Port: 5432
Database: appdb
User: appuser
Password: apppassword
```

### Key Files in Repository

```
reverse-auction-system/
├── docker-compose.yml          # Container orchestration
├── .env                         # Environment variables
├── nginx.conf                   # Frontend proxy config
├── deploy-auto.sh              # Automated deployment script
├── README-DEPLOY.md            # Deployment documentation
├── backend/
│   ├── Dockerfile              # Backend container definition
│   ├── entrypoint.sh           # Startup script with DB init
│   ├── package.json            # Node.js dependencies
│   ├── server.js               # Express server
│   ├── config/                 # Configuration files
│   ├── routes/                 # API routes
│   ├── middleware/             # Auth & validation
│   ├── utils/                  # Utilities (encryption, etc.)
│   └── scripts/
│       └── init-db.js          # Database schema creation
└── frontend/
    ├── Dockerfile              # Frontend container definition
    ├── package.json            # React dependencies
    ├── src/                    # React source code
    └── public/                 # Static assets
```

---

## Updating Your Deployment

### To update after pushing new code to Git:

```bash
# On Hostinger VPS
cd /var/www/reverse-auction-system

# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Verify
docker-compose ps
docker-compose logs -f
```

---

## Common Commands

### Container Management
```bash
# View all logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop everything
docker-compose down

# Start everything
docker-compose up -d

# Rebuild after code changes
docker-compose up -d --build
```

### Database Operations
```bash
# Check if tables exist
docker exec reverse_auction_backend psql postgresql://appuser:apppassword@93.127.194.188:5432/appdb -c "\\dt"

# Count users
docker exec reverse_auction_backend psql postgresql://appuser:apppassword@93.127.194.188:5432/appdb -c "SELECT COUNT(*) FROM users;"

# Manually run init script (if needed)
docker exec reverse_auction_backend node /app/scripts/init-db.js
```

---

## Repository Structure for Git

### Files to Include in Git:
✅ All source code (backend/, frontend/)
✅ Configuration files (docker-compose.yml, nginx.conf)
✅ Dockerfiles
✅ Scripts (deploy-auto.sh, entrypoint.sh, init-db.js)
✅ .env (with placeholder values)
✅ Documentation (README-DEPLOY.md)

### Files to Exclude (.gitignore):
```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
build/
dist/

# Environment (actual secrets)
.env.local
.env.production.local

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
```

---

## Troubleshooting

### Issue: "Cannot connect to database"

**Check:**
1. Database server is running at 93.127.194.188
2. Firewall allows connections from Hostinger VPS
3. Credentials are correct in .env

**Test connection:**
```bash
telnet 93.127.194.188 5432
# or
nc -zv 93.127.194.188 5432
```

### Issue: "Container keeps restarting"

**Check logs:**
```bash
docker-compose logs backend
```

**Common fixes:**
```bash
# Remove and rebuild
docker-compose down -v
docker-compose up -d --build
```

### Issue: "Database tables not created"

**Manually run init script:**
```bash
docker exec reverse_auction_backend node /app/scripts/init-db.js
```

---

## Production Checklist

Before going live:

- [ ] Change default admin password
- [ ] Update JWT_SECRET in .env (generate new)
- [ ] Update ENCRYPTION_KEY in .env (generate new)
- [ ] Set CORS_ORIGINS to your domain
- [ ] Set REACT_APP_BACKEND_URL to your domain
- [ ] Configure SSL certificate (Let's Encrypt)
- [ ] Set up automated backups
- [ ] Configure domain DNS to point to VPS IP
- [ ] Test all features (tender creation, bidding, etc.)
- [ ] Monitor logs for errors

---

## Support

### Quick Health Check:
```bash
curl http://localhost:8001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-31T..."
}
```

### Container Status:
```bash
docker-compose ps
```

All services should show "Up" status.

---

## Summary

**Your deployment is now:**
- ✅ Stored in Git for version control
- ✅ One-command deployable on Hostinger
- ✅ Connected to external PostgreSQL
- ✅ Auto-initializes database schema
- ✅ Containerized with Docker
- ✅ Production-ready with health checks

**Next Steps:**
1. Push code to GitHub
2. SSH to Hostinger VPS
3. Clone repository
4. Run: `sudo bash deploy-auto.sh`
5. Access application and change admin password

---

*For detailed deployment guide, see README-DEPLOY.md*
*For database schema details, see database/schema.sql*
