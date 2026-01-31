const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection configuration
const pool = new Pool({
  host: process.env.DB_HOST || '93.127.194.188',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'appdb',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'apppassword',
  ssl: false
});

const initializeDatabase = async () => {
  const client = await pool.connect();
  
  try {
    console.log('\n=== Database Initialization Started ===\n');

    // Check if tables already exist
    const checkTables = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    `);

    if (parseInt(checkTables.rows[0].count) > 0) {
      console.log('✓ Database tables already exist. Skipping initialization.');
      return;
    }

    console.log('Creating database schema...');

    // Enable extensions
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    console.log('✓ Extensions enabled');

    // Create all tables
    const schema = `
    -- System Configuration
    CREATE TABLE IF NOT EXISTS system_config (
      id SERIAL PRIMARY KEY,
      config_key VARCHAR(100) UNIQUE NOT NULL,
      config_value TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO system_config (config_key, config_value) VALUES 
      ('MAX_ITEMS_PER_TENDER', '2'),
      ('BIDDING_SYSTEM', 'TWO_PACKET'),
      ('TENDER_TYPE', 'OPEN_TENDER'),
      ('EVALUATION_CRITERIA', 'TOTAL_VALUE_WISE')
    ON CONFLICT (config_key) DO NOTHING;

    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'convener', 'vendor')),
      company_name VARCHAR(255),
      contact_number VARCHAR(20),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    -- Tenders Table
    CREATE TABLE IF NOT EXISTS tenders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_number VARCHAR(100) UNIQUE NOT NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      bidding_system VARCHAR(50) DEFAULT 'TWO_PACKET',
      tender_type VARCHAR(50) DEFAULT 'OPEN_TENDER',
      evaluation_criteria VARCHAR(50) DEFAULT 'TOTAL_VALUE_WISE',
      publish_date TIMESTAMP WITH TIME ZONE,
      techno_closing_date TIMESTAMP WITH TIME ZONE NOT NULL,
      techno_opening_date TIMESTAMP WITH TIME ZONE NOT NULL,
      financial_bidding_start TIMESTAMP WITH TIME ZONE,
      financial_bidding_end TIMESTAMP WITH TIME ZONE,
      earnest_money_deposit DECIMAL(15,2),
      estimated_value DECIMAL(15,2),
      delivery_period VARCHAR(100),
      delivery_schedule TEXT,
      pre_bid_conference BOOLEAN DEFAULT false,
      pre_bid_date TIMESTAMP WITH TIME ZONE,
      payment_exemption BOOLEAN DEFAULT false,
      payment_terms TEXT,
      instructions TEXT,
      terms_of_price TEXT,
      minimum_decrement_value DECIMAL(15,2),
      auto_extension_enabled BOOLEAN DEFAULT false,
      auto_extension_minutes INTEGER DEFAULT 5,
      status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'techno_opened', 'financial_bidding', 'closed', 'cancelled')),
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tenders_status ON tenders(status);
    CREATE INDEX IF NOT EXISTS idx_tenders_created_by ON tenders(created_by);

    -- Tender Items
    CREATE TABLE IF NOT EXISTS tender_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
      item_number INTEGER NOT NULL,
      item_description TEXT NOT NULL,
      quantity DECIMAL(15,2) NOT NULL,
      unit VARCHAR(50) NOT NULL,
      specifications TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tender_items_tender_id ON tender_items(tender_id);

    -- Tender Consignees
    CREATE TABLE IF NOT EXISTS tender_consignees (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
      tender_item_id UUID REFERENCES tender_items(id) ON DELETE CASCADE,
      consignee_name VARCHAR(255) NOT NULL,
      consignee_address TEXT NOT NULL,
      delivery_quantity DECIMAL(15,2) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Corrigendums
    CREATE TABLE IF NOT EXISTS corrigendums (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
      corrigendum_number VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      changes JSONB NOT NULL,
      issued_by UUID REFERENCES users(id),
      issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Techno Commercial Bids
    CREATE TABLE IF NOT EXISTS techno_commercial_bids (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
      vendor_id UUID REFERENCES users(id) ON DELETE CASCADE,
      bid_data_encrypted TEXT NOT NULL,
      status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_evaluation', 'approved', 'rejected')),
      evaluation_remarks TEXT,
      evaluated_by UUID REFERENCES users(id),
      evaluated_at TIMESTAMP WITH TIME ZONE,
      submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tender_id, vendor_id)
    );

    CREATE INDEX IF NOT EXISTS idx_techno_bids_tender_vendor ON techno_commercial_bids(tender_id, vendor_id);

    -- Financial Taxes Duties
    CREATE TABLE IF NOT EXISTS financial_taxes_duties (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
      vendor_id UUID REFERENCES users(id) ON DELETE CASCADE,
      packing_percentage DECIMAL(5,2) DEFAULT 0,
      excise_duty_type VARCHAR(50),
      excise_duty_rate DECIMAL(5,2) DEFAULT 0,
      other_charges_type VARCHAR(100),
      forwarding_per_unit DECIMAL(15,2) DEFAULT 0,
      cess_on_ed_percentage DECIMAL(5,2) DEFAULT 0,
      sales_tax_percentage DECIMAL(5,2) DEFAULT 0,
      freight DECIMAL(15,2) DEFAULT 0,
      submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tender_id, vendor_id)
    );

    -- Financial Bids
    CREATE TABLE IF NOT EXISTS financial_bids (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
      vendor_id UUID REFERENCES users(id) ON DELETE CASCADE,
      bid_number INTEGER NOT NULL,
      is_auto_bid BOOLEAN DEFAULT false,
      total_bid_value DECIMAL(15,2) NOT NULL,
      status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'outbid', 'winning')),
      submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_financial_bids_tender_vendor ON financial_bids(tender_id, vendor_id);

    -- Financial Bid Items
    CREATE TABLE IF NOT EXISTS financial_bid_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      financial_bid_id UUID REFERENCES financial_bids(id) ON DELETE CASCADE,
      tender_item_id UUID REFERENCES tender_items(id) ON DELETE CASCADE,
      basic_rate DECIMAL(15,2) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Bid History
    CREATE TABLE IF NOT EXISTS bid_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
      vendor_id UUID REFERENCES users(id) ON DELETE CASCADE,
      bid_type VARCHAR(50) NOT NULL CHECK (bid_type IN ('techno_commercial', 'financial')),
      action VARCHAR(50) NOT NULL,
      details JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      tender_id UUID REFERENCES tenders(id),
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
    `;

    await client.query(schema);
    console.log('✓ All tables created');

    // Create default admin user (password: admin123)
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('admin123', salt);
    
    console.log('Creating admin user with password: admin123');
    
    await client.query(`
      INSERT INTO users (email, password_hash, name, role, is_active)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `, ['admin@reverseauction.com', adminPasswordHash, 'System Administrator', 'admin', true]);

    console.log('✓ Default admin user created');
    console.log('  Email: admin@reverseauction.com');
    console.log('  Password: admin123');
    console.log('  ⚠️  CHANGE THIS PASSWORD AFTER FIRST LOGIN!');

    console.log('\n=== Database Initialization Complete ===\n');

  } catch (error) {
    console.error('\n✗ Database initialization error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Run initialization
initializeDatabase()
  .then(() => {
    console.log('Database ready for use!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
