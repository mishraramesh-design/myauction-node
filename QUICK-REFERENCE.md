# Quick Reference - Hostinger Docker Deployment

## 🚀 Quick Deploy (3 Steps)

### Step 1: Upload All Files
Upload your complete project to Hostinger at: `/docker/auction/`

**Must include:**
- docker-compose.yml
- .env
- nginx.conf
- backend/ (complete folder)
- frontend/ (complete folder)

### Step 2: SSH & Build
```bash
ssh root@your-vps-ip
cd /docker/auction
chmod +x backend/entrypoint.sh
docker-compose up -d --build
```

### Step 3: Verify
```bash
docker-compose ps
curl http://localhost:8001/api/health
```

---

## 📦 Required Files Checklist

```
/docker/auction/
├── docker-compose.yml ✓
├── .env ✓
├── nginx.conf ✓
├── backend/
│   ├── Dockerfile ✓
│   ├── entrypoint.sh ✓
│   ├── package.json ✓
│   ├── server.js ✓
│   ├── config/ ✓
│   ├── routes/ ✓
│   ├── middleware/ ✓
│   ├── utils/ ✓
│   └── scripts/ ✓
└── frontend/
    ├── Dockerfile ✓
    ├── package.json ✓
    ├── yarn.lock ✓
    ├── public/ ✓
    └── src/ ✓
```

---

## 🔧 Common Commands

### Build & Start
```bash
docker-compose up -d --build
```

### Check Status
```bash
docker-compose ps
```

### View Logs
```bash
docker-compose logs -f
```

### Restart
```bash
docker-compose restart
```

### Stop
```bash
docker-compose down
```

### Complete Rebuild
```bash
docker-compose down -v
docker-compose up -d --build
```

---

## 🗄️ Database Info

**Connection String:**
```
postgresql://appuser:apppassword@93.127.194.188:5432/appdb
```

**Auto-Created:**
- All tables (users, tenders, bids, etc.)
- Default admin: admin@reverseauction.com / admin123

**Test Connection:**
```bash
docker exec reverse_auction_backend node -e "
const {Pool} = require('pg');
new Pool({connectionString: 'postgresql://appuser:apppassword@93.127.194.188:5432/appdb'})
.query('SELECT NOW()').then(()=>console.log('✓')).catch(e=>console.log('✗',e.message));
"
```

---

## 🌐 Access URLs

- **Frontend:** http://your-vps-ip
- **Backend:** http://your-vps-ip:8001
- **Health Check:** http://your-vps-ip:8001/api/health

---

## ⚠️ Troubleshooting

### "No such image" Error
```bash
# Ensure all files uploaded
ls backend/Dockerfile
ls frontend/Dockerfile

# Rebuild
docker-compose down
docker-compose up -d --build
```

### Backend Won't Start
```bash
# Check logs
docker-compose logs backend

# Verify database connection
docker exec reverse_auction_backend env | grep DATABASE_URL
```

### Frontend 502 Error
```bash
# Check if backend is healthy
docker-compose ps

# Wait for backend health check
docker-compose logs backend | grep "healthy"
```

### Permission Denied
```bash
chmod +x backend/entrypoint.sh
docker-compose restart
```

---

## 📝 Quick Health Check

```bash
# All-in-one check
echo "Containers:" && docker-compose ps && \
echo -e "\nBackend Health:" && curl -s http://localhost:8001/api/health && \
echo -e "\n\nDatabase:" && docker exec reverse_auction_backend node -e "const {Pool}=require('pg');new Pool({connectionString:process.env.DATABASE_URL}).query('SELECT COUNT(*) FROM users').then(r=>console.log('✓ Users:',r.rows[0].count)).catch(e=>console.log('✗',e.message));"
```

---

## 🔐 Security Checklist

After deployment:
- [ ] Change admin password (admin123)
- [ ] Update JWT_SECRET in .env
- [ ] Update ENCRYPTION_KEY in .env
- [ ] Configure firewall (ports 22, 80, 443, 8001)
- [ ] Set CORS_ORIGINS to your domain

---

## 📊 Monitoring

```bash
# Resource usage
docker stats

# Disk space
df -h

# Container logs size
du -sh /var/lib/docker/containers/*

# Clean up
docker system prune -a
```

---

## 🔄 Update Workflow

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose up -d --build

# Verify
docker-compose ps
docker-compose logs -f
```

---

## 💾 Backup

```bash
# Backup database (manual)
docker exec reverse_auction_backend pg_dump \
  -h 93.127.194.188 -U appuser -d appdb \
  > backup_$(date +%Y%m%d).sql

# Restore
cat backup_20260131.sql | docker exec -i reverse_auction_backend \
  psql postgresql://appuser:apppassword@93.127.194.188:5432/appdb
```

---

## ✅ Post-Deployment Test

1. Access frontend: http://your-vps-ip
2. Login with: admin@reverseauction.com / admin123
3. Create a test tender
4. Register as vendor (in incognito)
5. Submit a bid
6. Verify real-time updates

---

**Need detailed help?** See HOSTINGER-FIX.md
