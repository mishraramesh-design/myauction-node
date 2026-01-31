# Reverse Auction System - Hostinger Deployment

## Quick Start (One Command)

### For New Installation:
```bash
sudo bash deploy-auto.sh
```

This single command will:
- ✅ Install Docker and Docker Compose
- ✅ Configure firewall
- ✅ Build all containers
- ✅ Connect to external PostgreSQL (93.127.194.188:5432)
- ✅ Create all database tables automatically
- ✅ Create default admin user
- ✅ Start all services

---

## Manual Deployment

If you prefer step-by-step control:

### 1. Upload Files to Hostinger

Upload these files to your VPS:
```
/var/www/reverse-auction/
├── docker-compose.yml
├── .env
├── nginx.conf
├── deploy-auto.sh
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── package.json
│   ├── server.js
│   ├── config/
│   ├── routes/
│   ├── middleware/
│   ├── utils/
│   └── scripts/
│       └── init-db.js
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── src/
    └── public/
```

### 2. Make Scripts Executable
```bash
cd /var/www/reverse-auction
chmod +x deploy-auto.sh
chmod +x backend/entrypoint.sh
```

### 3. Review Configuration

Edit `.env` file if needed:
```bash
nano .env
```

The external database is pre-configured:
- Host: 93.127.194.188
- Port: 5432
- Database: appdb
- User: appuser
- Password: apppassword

### 4. Deploy
```bash
# Option A: Automated (Recommended)
sudo bash deploy-auto.sh

# Option B: Manual
docker-compose up -d --build
```

### 5. Verify Deployment
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Test backend
curl http://localhost:8001/api/health
```

---

## Database Schema

The database schema is automatically created on first run by the `init-db.js` script.

**Tables Created:**
- users (with roles: admin, convener, vendor)
- tenders (NIT-RA)
- tender_items
- tender_consignees
- corrigendums
- techno_commercial_bids
- financial_taxes_duties
- financial_bids
- financial_bid_items
- bid_history
- notifications
- system_config

**Default Admin User:**
- Email: `admin@reverseauction.com`
- Password: `admin123`
- **⚠️ Change this password immediately after login!**

---

## External Database Connection

This setup connects to your external PostgreSQL database:

```
postgresql://appuser:apppassword@93.127.194.188:5432/appdb
```

### Database Requirements:
- PostgreSQL 12 or higher
- Extensions: uuid-ossp, pgcrypto
- Firewall: Port 5432 accessible from your Hostinger VPS

### Verify Database Connection:
```bash
docker exec reverse_auction_backend node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://appuser:apppassword@93.127.194.188:5432/appdb' });
pool.query('SELECT NOW()').then(r => console.log('✓ Connected')).catch(e => console.log('✗ Error:', e.message));
"
```

---

## Useful Commands

### Container Management
```bash
# View all logs
docker-compose logs -f

# View backend logs only
docker-compose logs -f backend

# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend

# Stop all services
docker-compose down

# Start all services
docker-compose up -d

# Rebuild after code changes
docker-compose up -d --build

# Remove everything and rebuild
docker-compose down -v
docker-compose up -d --build
```

### Database Operations
```bash
# Connect to database from backend container
docker exec -it reverse_auction_backend psql postgresql://appuser:apppassword@93.127.194.188:5432/appdb

# Run SQL query
docker exec reverse_auction_backend psql postgresql://appuser:apppassword@93.127.194.188:5432/appdb -c "SELECT * FROM users;"

# Reinitialize database schema
docker exec reverse_auction_backend node /app/scripts/init-db.js
```

### Monitoring
```bash
# Check resource usage
docker stats

# Check disk space
df -h

# Check container health
docker-compose ps
```

---

## Environment Variables

Key variables in `.env`:

```bash
# Database (External PostgreSQL)
DATABASE_URL=postgresql://appuser:apppassword@93.127.194.188:5432/appdb
DB_HOST=93.127.194.188
DB_PORT=5432
DB_NAME=appdb
DB_USER=appuser
DB_PASSWORD=apppassword

# Security
JWT_SECRET=your-jwt-secret-min-32-chars
ENCRYPTION_KEY=your-32-character-key

# Configuration
MAX_ITEMS_PER_TENDER=2
CORS_ORIGINS=*

# Frontend
REACT_APP_BACKEND_URL=http://your-domain.com
```

---

## Troubleshooting

### Issue 1: Database connection failed

**Check database accessibility:**
```bash
# From Hostinger VPS, test connection
telnet 93.127.194.188 5432

# If telnet not available, use nc
nc -zv 93.127.194.188 5432
```

**Solution:**
- Ensure PostgreSQL firewall allows connections from Hostinger VPS IP
- Check pg_hba.conf on database server
- Verify credentials are correct

### Issue 2: Container won't start

**Check logs:**
```bash
docker-compose logs backend
```

**Common fixes:**
```bash
# Remove old containers
docker-compose down -v

# Rebuild
docker-compose up -d --build
```

### Issue 3: Backend shows "Database initialization failed"

**Manually run init script:**
```bash
docker exec reverse_auction_backend node /app/scripts/init-db.js
```

### Issue 4: Frontend can't connect to backend

**Update REACT_APP_BACKEND_URL in .env:**
```bash
REACT_APP_BACKEND_URL=http://your-actual-domain.com
```

**Rebuild frontend:**
```bash
docker-compose up -d --build frontend
```

---

## SSL/HTTPS Setup (Optional)

For production with domain:

### 1. Install Certbot
```bash
apt install -y certbot
```

### 2. Get Certificate
```bash
docker-compose down
certbot certonly --standalone -d yourdomain.com
```

### 3. Update nginx.conf
Add SSL configuration and mount certificates in docker-compose.yml

### 4. Restart
```bash
docker-compose up -d
```

---

## Access the Application

### After deployment:

1. **Frontend:** http://your-hostinger-ip or http://your-domain.com
2. **Backend API:** http://your-hostinger-ip:8001
3. **Health Check:** http://your-hostinger-ip:8001/api/health

### First Login:
- Email: admin@reverseauction.com
- Password: admin123
- **Change this immediately!**

---

## Support

### View Logs:
```bash
cd /var/www/reverse-auction
docker-compose logs -f
```

### Check Service Status:
```bash
docker-compose ps
```

### Restart Everything:
```bash
docker-compose restart
```

---

**Configuration Summary:**
- ✅ External PostgreSQL connection
- ✅ Automated database schema creation
- ✅ No local PostgreSQL container needed
- ✅ One-command deployment
- ✅ Auto-restart on failure
- ✅ Health checks enabled

**Ready to deploy!** Just run: `sudo bash deploy-auto.sh`
