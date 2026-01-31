const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Database connection configuration
const pool = new Pool({
  host: process.env.DB_HOST || '93.127.194.188',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'appdb',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'apppassword',
  ssl: false
});

const resetAdminPassword = async () => {
  const client = await pool.connect();
  
  try {
    console.log('\n=== Resetting Admin Password ===\n');

    // Hash the password
    const newPassword = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    console.log('New password hash generated:', passwordHash);

    // Check if admin exists
    const checkResult = await client.query(
      'SELECT id, email FROM users WHERE email = $1',
      ['admin@reverseauction.com']
    );

    if (checkResult.rows.length > 0) {
      // Update existing admin
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2',
        [passwordHash, 'admin@reverseauction.com']
      );
      console.log('✓ Admin password updated successfully');
    } else {
      // Create new admin
      await client.query(
        `INSERT INTO users (email, password_hash, name, role, is_active)
         VALUES ($1, $2, $3, $4, $5)`,
        ['admin@reverseauction.com', passwordHash, 'System Administrator', 'admin', true]
      );
      console.log('✓ Admin user created successfully');
    }

    console.log('\nAdmin Login Credentials:');
    console.log('  Email: admin@reverseauction.com');
    console.log('  Password: admin123');
    console.log('\n⚠️  Please change this password after login!\n');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Run password reset
resetAdminPassword()
  .then(() => {
    console.log('Password reset completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to reset password:', error);
    process.exit(1);
  });
