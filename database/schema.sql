# Reverse Auction System - PostgreSQL Database Schema
# Compatible with PostgreSQL 12+

-- Drop existing tables if needed (use with caution)
-- DROP TABLE IF EXISTS notifications CASCADE;
-- DROP TABLE IF EXISTS bid_history CASCADE;
-- DROP TABLE IF EXISTS financial_bid_items CASCADE;
-- DROP TABLE IF EXISTS financial_bids CASCADE;
-- DROP TABLE IF EXISTS financial_taxes_duties CASCADE;
-- DROP TABLE IF EXISTS techno_commercial_bids CASCADE;
-- DROP TABLE IF EXISTS corrigendums CASCADE;
-- DROP TABLE IF EXISTS tender_consignees CASCADE;
-- DROP TABLE IF EXISTS tender_items CASCADE;
-- DROP TABLE IF EXISTS tenders CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS system_config CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== SYSTEM CONFIGURATION ====================
CREATE TABLE IF NOT EXISTS system_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration
INSERT INTO system_config (config_key, config_value) VALUES 
  ('MAX_ITEMS_PER_TENDER', '2'),
  ('BIDDING_SYSTEM', 'TWO_PACKET'),
  ('TENDER_TYPE', 'OPEN_TENDER'),
  ('EVALUATION_CRITERIA', 'TOTAL_VALUE_WISE')
ON CONFLICT (config_key) DO NOTHING;

-- ==================== USERS TABLE ====================
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

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ==================== TENDERS (NIT-RA) TABLE ====================
CREATE TABLE IF NOT EXISTS tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_number VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Tender Details (Fixed as per SRS)
  bidding_system VARCHAR(50) DEFAULT 'TWO_PACKET',
  tender_type VARCHAR(50) DEFAULT 'OPEN_TENDER',
  evaluation_criteria VARCHAR(50) DEFAULT 'TOTAL_VALUE_WISE',
  
  -- Important Dates
  publish_date TIMESTAMP WITH TIME ZONE,
  techno_closing_date TIMESTAMP WITH TIME ZONE NOT NULL,
  techno_opening_date TIMESTAMP WITH TIME ZONE NOT NULL,
  financial_bidding_start TIMESTAMP WITH TIME ZONE,
  financial_bidding_end TIMESTAMP WITH TIME ZONE,
  
  -- Financial Details
  earnest_money_deposit DECIMAL(15,2),
  estimated_value DECIMAL(15,2),
  delivery_period VARCHAR(100),
  delivery_schedule TEXT,
  
  -- Additional Fields
  pre_bid_conference BOOLEAN DEFAULT false,
  pre_bid_date TIMESTAMP WITH TIME ZONE,
  payment_exemption BOOLEAN DEFAULT false,
  payment_terms TEXT,
  instructions TEXT,
  terms_of_price TEXT,
  
  -- Auction Parameters
  minimum_decrement_value DECIMAL(15,2),
  auto_extension_enabled BOOLEAN DEFAULT false,
  auto_extension_minutes INTEGER DEFAULT 5,
  
  -- Status Management
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'techno_opened', 'financial_bidding', 'closed', 'cancelled')),
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenders_status ON tenders(status);
CREATE INDEX IF NOT EXISTS idx_tenders_created_by ON tenders(created_by);
CREATE INDEX IF NOT EXISTS idx_tenders_tender_number ON tenders(tender_number);

-- ==================== TENDER ITEMS TABLE ====================
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

-- ==================== TENDER CONSIGNEES TABLE ====================
CREATE TABLE IF NOT EXISTS tender_consignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
  tender_item_id UUID REFERENCES tender_items(id) ON DELETE CASCADE,
  consignee_name VARCHAR(255) NOT NULL,
  consignee_address TEXT NOT NULL,
  delivery_quantity DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tender_consignees_tender_id ON tender_consignees(tender_id);

-- ==================== CORRIGENDUM TABLE ====================
CREATE TABLE IF NOT EXISTS corrigendums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
  corrigendum_number VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  changes JSONB NOT NULL,
  issued_by UUID REFERENCES users(id),
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_corrigendums_tender_id ON corrigendums(tender_id);

-- ==================== TECHNO-COMMERCIAL BIDS TABLE ====================
CREATE TABLE IF NOT EXISTS techno_commercial_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Bid Data (Encrypted)
  bid_data_encrypted TEXT NOT NULL,
  
  -- Evaluation
  status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_evaluation', 'approved', 'rejected')),
  evaluation_remarks TEXT,
  evaluated_by UUID REFERENCES users(id),
  evaluated_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tender_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_techno_bids_tender_vendor ON techno_commercial_bids(tender_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_techno_bids_status ON techno_commercial_bids(status);

-- ==================== FINANCIAL BID - TAXES AND DUTIES TABLE ====================
CREATE TABLE IF NOT EXISTS financial_taxes_duties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Tax Details (as per SRS)
  packing_percentage DECIMAL(5,2) DEFAULT 0,
  excise_duty_type VARCHAR(50),
  excise_duty_rate DECIMAL(5,2) DEFAULT 0,
  other_charges_type VARCHAR(100),
  forwarding_per_unit DECIMAL(15,2) DEFAULT 0,
  cess_on_ed_percentage DECIMAL(5,2) DEFAULT 0,
  sales_tax_percentage DECIMAL(5,2) DEFAULT 0,
  freight DECIMAL(15,2) DEFAULT 0,
  
  -- Metadata
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tender_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_taxes_tender_vendor ON financial_taxes_duties(tender_id, vendor_id);

-- ==================== FINANCIAL BIDS (BASIC RATES) TABLE ====================
CREATE TABLE IF NOT EXISTS financial_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bid_number INTEGER NOT NULL,
  
  -- Bid Type
  is_auto_bid BOOLEAN DEFAULT false,
  
  -- Total Bid Value (calculated)
  total_bid_value DECIMAL(15,2) NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'outbid', 'winning')),
  
  -- Metadata
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_bids_tender_vendor ON financial_bids(tender_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_financial_bids_tender_value ON financial_bids(tender_id, total_bid_value);

-- ==================== FINANCIAL BID ITEMS (BASIC RATES PER ITEM) ====================
CREATE TABLE IF NOT EXISTS financial_bid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_bid_id UUID REFERENCES financial_bids(id) ON DELETE CASCADE,
  tender_item_id UUID REFERENCES tender_items(id) ON DELETE CASCADE,
  basic_rate DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_financial_bid_items_bid_id ON financial_bid_items(financial_bid_id);

-- ==================== BID HISTORY (AUDIT TRAIL) ====================
CREATE TABLE IF NOT EXISTS bid_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bid_type VARCHAR(50) NOT NULL CHECK (bid_type IN ('techno_commercial', 'financial')),
  action VARCHAR(50) NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bid_history_tender_vendor ON bid_history(tender_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_bid_history_created_at ON bid_history(created_at);

-- ==================== NOTIFICATIONS TABLE ====================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tender_id UUID REFERENCES tenders(id),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ==================== CREATE DEFAULT ADMIN USER ====================
-- Password: admin123 (hash generated with bcrypt)
INSERT INTO users (email, password_hash, name, role, is_active)
VALUES (
  'admin@reverseauction.com',
  '$2a$10$XQkFvxQ9qZ3h5v8YxVx3d.jW3fGJ5K8dKLfPp8eCXJGqHx8kPy4mC',
  'System Administrator',
  'admin',
  true
)
ON CONFLICT (email) DO NOTHING;

-- ==================== USEFUL VIEWS ====================

-- View: Active Tenders with Item Count
CREATE OR REPLACE VIEW v_active_tenders AS
SELECT 
  t.*,
  u.name as creator_name,
  COUNT(DISTINCT ti.id) as item_count,
  COUNT(DISTINCT tcb.id) as techno_bid_count
FROM tenders t
LEFT JOIN users u ON t.created_by = u.id
LEFT JOIN tender_items ti ON t.id = ti.tender_id
LEFT JOIN techno_commercial_bids tcb ON t.id = tcb.tender_id
WHERE t.status IN ('published', 'techno_opened', 'financial_bidding')
GROUP BY t.id, u.name;

-- View: Winning Bids
CREATE OR REPLACE VIEW v_winning_bids AS
SELECT 
  fb.*,
  t.tender_number,
  t.title as tender_title,
  u.name as vendor_name,
  u.company_name
FROM financial_bids fb
JOIN tenders t ON fb.tender_id = t.id
JOIN users u ON fb.vendor_id = u.id
WHERE fb.status = 'winning'
ORDER BY fb.submitted_at DESC;

-- ==================== FUNCTIONS ====================

-- Function to update tender status automatically
CREATE OR REPLACE FUNCTION update_tender_status()
RETURNS void AS $$
BEGIN
  -- Update tenders to techno_opened after closing date
  UPDATE tenders
  SET status = 'techno_opened'
  WHERE status = 'published' 
    AND techno_closing_date <= CURRENT_TIMESTAMP;
  
  -- Update tenders to financial_bidding after opening and having approved bids
  UPDATE tenders t
  SET status = 'financial_bidding'
  WHERE t.status = 'techno_opened'
    AND t.techno_opening_date <= CURRENT_TIMESTAMP
    AND t.financial_bidding_start <= CURRENT_TIMESTAMP
    AND EXISTS (
      SELECT 1 FROM techno_commercial_bids tcb
      WHERE tcb.tender_id = t.id AND tcb.status = 'approved'
    );
  
  -- Close financial bidding
  UPDATE tenders
  SET status = 'closed'
  WHERE status = 'financial_bidding'
    AND financial_bidding_end <= CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ==================== GRANTS (if needed for specific user) ====================
-- Replace 'auction_user' with your database user
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO auction_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO auction_user;

-- ==================== SUMMARY ====================
-- Database setup complete!
-- Total Tables: 14
-- - system_config
-- - users
-- - tenders
-- - tender_items
-- - tender_consignees
-- - corrigendums
-- - techno_commercial_bids
-- - financial_taxes_duties
-- - financial_bids
-- - financial_bid_items
-- - bid_history
-- - notifications

-- Default Admin Login:
-- Email: admin@reverseauction.com
-- Password: admin123
-- IMPORTANT: Change this password after first login!
