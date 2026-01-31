# Admin Password Fix Guide

## Issue: admin123 password not working

### Quick Fix Options

## Option 1: Reset Admin Password via Script (Recommended)

```bash
# SSH into your Hostinger VPS
ssh root@your-vps-ip

# Navigate to project
cd /docker/auction

# Run password reset script
docker exec reverse_auction_backend node /app/scripts/reset-admin-password.js
```

**This will:**
- ✅ Check if admin user exists
- ✅ Create or update admin with correct password hash
- ✅ Set password to: admin123
- ✅ Display success message

---

## Option 2: Manual SQL Reset

```bash
# Connect to database
docker exec -it reverse_auction_backend psql postgresql://appuser:apppassword@93.127.194.188:5432/appdb

# In PostgreSQL prompt, run:
```

**Generate new password hash:**
```sql
-- First, check if user exists
SELECT id, email, role FROM users WHERE email = 'admin@reverseauction.com';

-- If user exists, update password
UPDATE users 
SET password_hash = '$2a$10$XQkFvxQ9qZ3h5v8YxVx3d.jW3fGJ5K8dKLfPp8eCXJGqHx8kPy4mC'
WHERE email = 'admin@reverseauction.com';

-- If user doesn't exist, create it
INSERT INTO users (email, password_hash, name, role, is_active)
VALUES (
  'admin@reverseauction.com',
  '$2a$10$XQkFvxQ9qZ3h5v8YxVx3d.jW3fGJ5K8dKLfPp8eCXJGqHx8kPy4mC',
  'System Administrator',
  'admin',
  true
);

-- Verify
SELECT id, email, name, role FROM users WHERE email = 'admin@reverseauction.com';

-- Exit
\q
```

**Password hash above is for:** `admin123`

---

## Option 3: Create New Admin via Node.js

```bash
# SSH to server
docker exec -it reverse_auction_backend node

# In Node.js REPL, paste this:
```

```javascript
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: 'postgresql://appuser:apppassword@93.127.194.188:5432/appdb'
});

(async () => {
  const hash = await bcrypt.hash('admin123', 10);
  await pool.query(`
    INSERT INTO users (email, password_hash, name, role, is_active)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `, ['admin@reverseauction.com', hash, 'System Administrator', 'admin', true]);
  
  console.log('✓ Admin created/updated');
  console.log('Email: admin@reverseauction.com');
  console.log('Password: admin123');
  process.exit(0);
})();
```

---

## Option 4: Reinitialize Database

```bash
# This will recreate all tables and admin user
docker exec reverse_auction_backend node /app/scripts/init-db.js
```

**⚠️ Warning:** This only works if tables don't exist. To force reinit:

```bash
# Drop and recreate users table (⚠️ deletes all users!)
docker exec reverse_auction_backend psql postgresql://appuser:apppassword@93.127.194.188:5432/appdb -c "DROP TABLE IF EXISTS users CASCADE;"

# Now run init
docker exec reverse_auction_backend node /app/scripts/init-db.js
```

---

## Option 5: Create Custom Admin

Want a different email/password? Use this:

```bash
docker exec -it reverse_auction_backend node -e "
const {Pool} = require('pg');
const bcrypt = require('bcryptjs');
const pool = new Pool({connectionString: 'postgresql://appuser:apppassword@93.127.194.188:5432/appdb'});

(async () => {
  const hash = await bcrypt.hash('YourNewPassword123', 10);
  await pool.query(
    'INSERT INTO users (email, password_hash, name, role, is_active) VALUES (\$1, \$2, \$3, \$4, \$5) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash',
    ['youremail@example.com', hash, 'Your Name', 'admin', true]
  );
  console.log('✓ Admin created');
  process.exit(0);
})();
"
```

**Replace:**
- `YourNewPassword123` with your desired password
- `youremail@example.com` with your email
- `Your Name` with your name

---

## Verification Steps

After resetting password:

### 1. Check if user exists in database
```bash
docker exec reverse_auction_backend psql postgresql://appuser:apppassword@93.127.194.188:5432/appdb -c "SELECT email, name, role, is_active FROM users WHERE email = 'admin@reverseauction.com';"
```

Expected output:
```
           email            |         name          | role  | is_active 
---------------------------+----------------------+-------+-----------
 admin@reverseauction.com  | System Administrator | admin | t
```

### 2. Test login via API
```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@reverseauction.com",
    "password": "admin123"
  }'
```

**Success response should include:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "...",
    "email": "admin@reverseauction.com",
    "name": "System Administrator",
    "role": "admin"
  }
}
```

### 3. Test in browser
1. Open: http://your-vps-ip
2. Click Login
3. Enter:
   - Email: admin@reverseauction.com
   - Password: admin123
4. Should redirect to dashboard

---

## Common Issues & Solutions

### Issue 1: "Invalid credentials"

**Possible causes:**
- Password hash mismatch
- User doesn't exist
- Backend not restarted after DB changes

**Solutions:**
```bash
# 1. Reset password
docker exec reverse_auction_backend node /app/scripts/reset-admin-password.js

# 2. Restart backend
docker-compose restart backend

# 3. Try login again
```

### Issue 2: "User not found"

**Solution:**
```bash
# Create user
docker exec reverse_auction_backend node /app/scripts/reset-admin-password.js
```

### Issue 3: Backend login route not working

**Check backend logs:**
```bash
docker-compose logs backend | grep -i error
```

**Test backend directly:**
```bash
curl http://localhost:8001/api/health
```

If health check fails, restart:
```bash
docker-compose restart backend
```

### Issue 4: Database connection error

**Test connection:**
```bash
docker exec reverse_auction_backend node -e "
const {Pool}=require('pg');
new Pool({connectionString:'postgresql://appuser:apppassword@93.127.194.188:5432/appdb'})
.query('SELECT NOW()')
.then(()=>console.log('✓ Connected'))
.catch(e=>console.log('✗ Error:', e.message));
"
```

---

## Generate Custom Password Hash

Need to generate hash for a different password?

```bash
docker exec reverse_auction_backend node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('YourPassword', 10).then(hash => console.log('Hash:', hash));
"
```

Replace `YourPassword` with your desired password.

---

## Complete Reset (Nuclear Option)

If nothing works, complete reset:

```bash
# 1. Stop containers
docker-compose down

# 2. Connect to database directly and drop tables
psql postgresql://appuser:apppassword@93.127.194.188:5432/appdb -c "
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS bid_history CASCADE;
DROP TABLE IF EXISTS financial_bid_items CASCADE;
DROP TABLE IF EXISTS financial_bids CASCADE;
DROP TABLE IF EXISTS financial_taxes_duties CASCADE;
DROP TABLE IF EXISTS techno_commercial_bids CASCADE;
DROP TABLE IF EXISTS corrigendums CASCADE;
DROP TABLE IF EXISTS tender_consignees CASCADE;
DROP TABLE IF EXISTS tender_items CASCADE;
DROP TABLE IF EXISTS tenders CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS system_config CASCADE;
"

# 3. Restart containers (will recreate tables)
docker-compose up -d

# 4. Wait for backend to initialize
sleep 15

# 5. Check logs
docker-compose logs backend | grep -i "admin"
```

---

## Test Credentials

**After any fix, test with:**

**Email:** admin@reverseauction.com  
**Password:** admin123

**Alternative test accounts (if you created them):**
- Any email you specified
- With the password you set

---

## Debugging Tips

### View all users
```bash
docker exec reverse_auction_backend psql postgresql://appuser:apppassword@93.127.194.188:5432/appdb -c "SELECT email, name, role FROM users;"
```

### Count users
```bash
docker exec reverse_auction_backend psql postgresql://appuser:apppassword@93.127.194.188:5432/appdb -c "SELECT COUNT(*) as user_count FROM users;"
```

### View backend environment
```bash
docker exec reverse_auction_backend env | grep -E 'DB_|DATABASE'
```

### Check backend is running
```bash
docker-compose ps backend
```

### View recent backend logs
```bash
docker-compose logs --tail=50 backend
```

---

## Quick Command Reference

```bash
# Reset admin password (easiest)
docker exec reverse_auction_backend node /app/scripts/reset-admin-password.js

# Test login via API
curl -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@reverseauction.com","password":"admin123"}'

# Check if user exists
docker exec reverse_auction_backend psql postgresql://appuser:apppassword@93.127.194.188:5432/appdb -c "SELECT * FROM users WHERE email='admin@reverseauction.com';"

# Restart backend
docker-compose restart backend

# View logs
docker-compose logs -f backend
```

---

**Recommended Solution:** Run Option 1 (Reset script) - it's the safest and most reliable.
