# Hostinger Docker Deployment - Quick Fix Guide

## Issue: "No such image" Error

The error occurs because Hostinger's Docker system needs to build images first.

## Solution: Upload Complete Project Structure

### Required File Structure on Hostinger:

```
/docker/auction/  (or your project folder)
├── docker-compose.yml
├── .env
├── nginx.conf
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── package.json
│   ├── server.js
│   ├── config/
│   │   ├── database.js
│   │   └── config.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── tenders.js
│   │   ├── bids.js
│   │   └── notifications.js
│   ├── middleware/
│   │   └── auth.js
│   ├── utils/
│   │   └── encryption.js
│   └── scripts/
│       └── init-db.js
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── yarn.lock
    ├── public/
    └── src/
        ├── App.js
        ├── index.js
        ├── App.css
        ├── index.css
        ├── contexts/
        │   ├── AuthContext.js
        │   └── SocketContext.js
        ├── pages/
        │   ├── Landing.js
        │   ├── Login.js
        │   ├── Register.js
        │   ├── Dashboard.js
        │   ├── CreateAuction.js
        │   └── AuctionDetail.js
        └── components/
            ├── AuctionCard.js
            └── NotificationPanel.js
```

## Step-by-Step Fix

### Method 1: Using Hostinger File Manager

1. **Download ALL files from GitHub to your computer**
   ```bash
   git clone https://github.com/YOUR_USERNAME/reverse-auction.git
   cd reverse-auction
   ```

2. **Upload via Hostinger hPanel:**
   - Login to Hostinger hPanel
   - Go to VPS → File Manager
   - Navigate to `/docker/auction/` (or create this folder)
   - Upload ALL folders and files maintaining the structure above
   - Make sure to include:
     - ✅ docker-compose.yml
     - ✅ .env
     - ✅ nginx.conf
     - ✅ Complete backend/ folder with all subfolders
     - ✅ Complete frontend/ folder with all subfolders

3. **Via Hostinger Terminal (in hPanel):**
   ```bash
   cd /docker/auction
   
   # Make scripts executable
   chmod +x backend/entrypoint.sh
   
   # Build and start
   docker-compose up -d --build
   
   # Check status
   docker-compose ps
   
   # View logs
   docker-compose logs -f
   ```

### Method 2: Using SSH + Git

1. **SSH into Hostinger VPS:**
   ```bash
   ssh root@your-vps-ip
   ```

2. **Clone repository:**
   ```bash
   cd /docker
   git clone https://github.com/YOUR_USERNAME/reverse-auction.git auction
   cd auction
   ```

3. **Make scripts executable:**
   ```bash
   chmod +x backend/entrypoint.sh
   ```

4. **Build and deploy:**
   ```bash
   docker-compose up -d --build
   ```

### Method 3: Using SCP (from local machine)

```bash
# From your local machine
scp -r /path/to/reverse-auction/* root@your-vps-ip:/docker/auction/

# Then SSH and run
ssh root@your-vps-ip
cd /docker/auction
chmod +x backend/entrypoint.sh
docker-compose up -d --build
```

## Verification Steps

After upload, verify all files exist:

```bash
cd /docker/auction

# Check main files
ls -la

# Check backend structure
ls -la backend/
ls -la backend/config/
ls -la backend/routes/
ls -la backend/scripts/

# Check frontend structure
ls -la frontend/
ls -la frontend/src/
ls -la frontend/src/pages/

# Verify docker-compose.yml
cat docker-compose.yml | head -20
```

## Build and Deploy

```bash
cd /docker/auction

# Build images (this takes 3-5 minutes)
docker-compose build

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Expected Output

After successful build:

```
✓ Building backend... done
✓ Building frontend... done
✓ Creating network auction_auction_network... done
✓ Creating reverse_auction_backend... done
✓ Creating reverse_auction_frontend... done
```

Check status:
```bash
docker-compose ps
```

You should see:
```
NAME                        STATUS              PORTS
reverse_auction_backend     Up (healthy)        0.0.0.0:8001->8001/tcp
reverse_auction_frontend    Up                  0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

## Access Application

1. **Frontend:** `http://your-vps-ip` or `http://your-domain.com`
2. **Backend Health:** `http://your-vps-ip:8001/api/health`
3. **Login:** 
   - Email: admin@reverseauction.com
   - Password: admin123

## Common Issues

### Issue 1: "Error response from daemon: No such image"

**Cause:** Missing source files or wrong directory structure

**Fix:**
```bash
# Ensure you're in correct directory
cd /docker/auction

# Check if Dockerfiles exist
ls backend/Dockerfile
ls frontend/Dockerfile

# Rebuild
docker-compose down
docker-compose up -d --build
```

### Issue 2: "Cannot find module"

**Cause:** package.json or dependencies missing

**Fix:**
```bash
# Check if package.json exists
ls backend/package.json
ls frontend/package.json

# If missing, upload the complete folders again
```

### Issue 3: "Permission denied: entrypoint.sh"

**Fix:**
```bash
chmod +x backend/entrypoint.sh
docker-compose restart backend
```

### Issue 4: Build fails on frontend

**Check if yarn.lock exists:**
```bash
ls frontend/yarn.lock
```

If missing, create it:
```bash
cd frontend
yarn install
# This creates yarn.lock, then rebuild
cd ..
docker-compose up -d --build
```

## Hostinger-Specific Commands

**View build logs:**
```bash
docker-compose build --no-cache --progress=plain
```

**Force rebuild everything:**
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

**Check image sizes:**
```bash
docker images | grep auction
```

**Clean up old images:**
```bash
docker system prune -a
```

## Database Connection Test

```bash
# Test from backend container
docker exec reverse_auction_backend node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://appuser:apppassword@93.127.194.188:5432/appdb' });
pool.query('SELECT NOW()').then(r => console.log('✓ Connected:', r.rows[0])).catch(e => console.log('✗ Error:', e.message));
"
```

## Need Help?

**View all logs:**
```bash
docker-compose logs -f
```

**Check specific service:**
```bash
docker-compose logs backend
docker-compose logs frontend
```

**Restart services:**
```bash
docker-compose restart
```

**Complete reset:**
```bash
docker-compose down -v
docker-compose up -d --build
```

## Checklist

- [ ] All files uploaded to `/docker/auction/`
- [ ] backend/Dockerfile exists
- [ ] frontend/Dockerfile exists
- [ ] docker-compose.yml exists
- [ ] .env file configured
- [ ] entrypoint.sh is executable
- [ ] Run: `docker-compose up -d --build`
- [ ] Check: `docker-compose ps`
- [ ] Test: `curl http://localhost:8001/api/health`
- [ ] Access frontend in browser

---

**Summary:** The issue is that source files weren't uploaded. Make sure to upload the COMPLETE project structure with all backend/ and frontend/ folders before running docker-compose.
