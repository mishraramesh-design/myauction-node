const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');

// ==================== TECHNO-COMMERCIAL BIDS ====================

// Submit Techno-Commercial Bid
router.post('/techno-commercial',
  authenticateToken,
  authorizeRoles('vendor'),
  [
    body('tender_id').isUUID(),
    body('bid_data').isObject()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tender_id, bid_data } = req.body;

      // Check if tender exists and is published
      const tenderResult = await pool.query(
        'SELECT * FROM tenders WHERE id = $1',
        [tender_id]
      );

      if (tenderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Tender not found' });
      }

      const tender = tenderResult.rows[0];

      if (tender.status !== 'published') {
        return res.status(400).json({ error: 'Tender is not open for bidding' });
      }

      // Check if already submitted
      const existingBid = await pool.query(
        'SELECT id FROM techno_commercial_bids WHERE tender_id = $1 AND vendor_id = $2',
        [tender_id, req.user.id]
      );

      if (existingBid.rows.length > 0) {
        return res.status(400).json({ error: 'Techno-commercial bid already submitted' });
      }

      // Encrypt bid data
      const encryptedData = encrypt(JSON.stringify(bid_data));

      // Insert bid
      const result = await pool.query(
        `INSERT INTO techno_commercial_bids (tender_id, vendor_id, bid_data_encrypted, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id, tender_id, vendor_id, status, submitted_at`,
        [tender_id, req.user.id, encryptedData, 'submitted']
      );

      // Record in history
      await pool.query(
        `INSERT INTO bid_history (tender_id, vendor_id, bid_type, action)
         VALUES ($1, $2, $3, $4)`,
        [tender_id, req.user.id, 'techno_commercial', 'submitted']
      );

      res.status(201).json({
        message: 'Techno-commercial bid submitted successfully',
        bid: result.rows[0]
      });
    } catch (error) {
      console.error('Submit techno-commercial bid error:', error);
      res.status(500).json({ error: 'Failed to submit bid' });
    }
  }
);

// Get vendor's techno-commercial bids
router.get('/techno-commercial/my-bids', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tcb.*, t.tender_number, t.title, t.status as tender_status
       FROM techno_commercial_bids tcb
       JOIN tenders t ON tcb.tender_id = t.id
       WHERE tcb.vendor_id = $1
       ORDER BY tcb.submitted_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get my techno-commercial bids error:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

// Get approved bids for vendor (for financial bidding)
router.get('/techno-commercial/approved', authenticateToken, authorizeRoles('vendor'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tcb.*, t.tender_number, t.title, t.financial_bidding_start, t.financial_bidding_end
       FROM techno_commercial_bids tcb
       JOIN tenders t ON tcb.tender_id = t.id
       WHERE tcb.vendor_id = $1 AND tcb.status = $2
       ORDER BY tcb.submitted_at DESC`,
      [req.user.id, 'approved']
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get approved bids error:', error);
    res.status(500).json({ error: 'Failed to fetch approved bids' });
  }
});

// Evaluate Techno-Commercial Bids (Admin/Convener)
router.put('/techno-commercial/:bid_id/evaluate',
  authenticateToken,
  authorizeRoles('admin', 'convener'),
  [
    body('status').isIn(['approved', 'rejected']),
    body('evaluation_remarks').optional().trim()
  ],
  async (req, res) => {
    try {
      const { bid_id } = req.params;
      const { status, evaluation_remarks } = req.body;

      const result = await pool.query(
        `UPDATE techno_commercial_bids 
         SET status = $1, evaluation_remarks = $2, evaluated_by = $3, evaluated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [status, evaluation_remarks, req.user.id, bid_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Bid not found' });
      }

      // Create notification for vendor
      await pool.query(
        `INSERT INTO notifications (user_id, tender_id, message)
         VALUES ($1, $2, $3)`,
        [result.rows[0].vendor_id, result.rows[0].tender_id, 
         `Your techno-commercial bid has been ${status}`]
      );

      res.json({
        message: 'Bid evaluated successfully',
        bid: result.rows[0]
      });
    } catch (error) {
      console.error('Evaluate techno-commercial bid error:', error);
      res.status(500).json({ error: 'Failed to evaluate bid' });
    }
  }
);

// ==================== FINANCIAL BIDS - TAXES & DUTIES ====================

// Submit/Update Taxes and Duties
router.post('/financial/taxes-duties',
  authenticateToken,
  authorizeRoles('vendor'),
  [
    body('tender_id').isUUID()
  ],
  async (req, res) => {
    try {
      const {
        tender_id, packing_percentage, excise_duty_type, excise_duty_rate,
        other_charges_type, forwarding_per_unit, cess_on_ed_percentage,
        sales_tax_percentage, freight
      } = req.body;

      // Check if vendor is approved for this tender
      const approvalCheck = await pool.query(
        'SELECT id FROM techno_commercial_bids WHERE tender_id = $1 AND vendor_id = $2 AND status = $3',
        [tender_id, req.user.id, 'approved']
      );

      if (approvalCheck.rows.length === 0) {
        return res.status(403).json({ error: 'You are not approved for this tender' });
      }

      // Upsert taxes and duties
      const result = await pool.query(
        `INSERT INTO financial_taxes_duties 
         (tender_id, vendor_id, packing_percentage, excise_duty_type, excise_duty_rate,
          other_charges_type, forwarding_per_unit, cess_on_ed_percentage, sales_tax_percentage, freight)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (tender_id, vendor_id) 
         DO UPDATE SET 
           packing_percentage = $3, excise_duty_type = $4, excise_duty_rate = $5,
           other_charges_type = $6, forwarding_per_unit = $7, cess_on_ed_percentage = $8,
           sales_tax_percentage = $9, freight = $10, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [tender_id, req.user.id, packing_percentage, excise_duty_type, excise_duty_rate,
         other_charges_type, forwarding_per_unit, cess_on_ed_percentage, sales_tax_percentage, freight]
      );

      res.json({
        message: 'Taxes and duties submitted successfully',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Submit taxes and duties error:', error);
      res.status(500).json({ error: 'Failed to submit taxes and duties' });
    }
  }
);

// Get vendor's taxes and duties for a tender
router.get('/financial/taxes-duties/:tender_id', 
  authenticateToken, 
  authorizeRoles('vendor'), 
  async (req, res) => {
    try {
      const { tender_id } = req.params;

      const result = await pool.query(
        'SELECT * FROM financial_taxes_duties WHERE tender_id = $1 AND vendor_id = $2',
        [tender_id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Taxes and duties not submitted yet' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get taxes and duties error:', error);
      res.status(500).json({ error: 'Failed to fetch taxes and duties' });
    }
  }
);

// ==================== FINANCIAL BIDS - BASIC RATES ====================

// Submit Financial Bid (Basic Rates)
router.post('/financial/basic-rates',
  authenticateToken,
  authorizeRoles('vendor'),
  [
    body('tender_id').isUUID(),
    body('item_rates').isArray({ min: 1 })
  ],
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { tender_id, item_rates } = req.body;

      // Check if taxes/duties submitted
      const taxesCheck = await client.query(
        'SELECT id FROM financial_taxes_duties WHERE tender_id = $1 AND vendor_id = $2',
        [tender_id, req.user.id]
      );

      if (taxesCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Please submit taxes and duties first' });
      }

      // Get tender and items
      const tenderResult = await client.query(
        'SELECT * FROM tenders WHERE id = $1',
        [tender_id]
      );

      if (tenderResult.rows.length === 0) {
        return res.status(404).json({ error: 'Tender not found' });
      }

      const tender = tenderResult.rows[0];

      if (tender.status !== 'financial_bidding') {
        return res.status(400).json({ error: 'Financial bidding is not open' });
      }

      const itemsResult = await client.query(
        'SELECT * FROM tender_items WHERE tender_id = $1',
        [tender_id]
      );

      if (itemsResult.rows.length !== item_rates.length) {
        return res.status(400).json({ error: 'Must provide rates for all items' });
      }

      // Get taxes/duties to calculate total
      const taxesResult = await client.query(
        'SELECT * FROM financial_taxes_duties WHERE tender_id = $1 AND vendor_id = $2',
        [tender_id, req.user.id]
      );

      const taxes = taxesResult.rows[0];

      // Calculate total bid value
      let totalBidValue = 0;
      const items = itemsResult.rows;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rate = item_rates.find(r => r.item_id === item.id);
        
        if (!rate) {
          return res.status(400).json({ error: `Rate missing for item ${item.item_number}` });
        }

        const basicValue = rate.basic_rate * item.quantity;
        const packingValue = basicValue * (taxes.packing_percentage / 100);
        const exciseDuty = (basicValue + packingValue) * (taxes.excise_duty_rate / 100);
        const cess = exciseDuty * (taxes.cess_on_ed_percentage / 100);
        const salesTax = (basicValue + packingValue + exciseDuty) * (taxes.sales_tax_percentage / 100);
        const forwarding = taxes.forwarding_per_unit * item.quantity;
        
        const itemTotal = basicValue + packingValue + exciseDuty + cess + salesTax + forwarding + taxes.freight;
        totalBidValue += itemTotal;
      }

      // Check minimum decrement
      const lastBidResult = await client.query(
        `SELECT total_bid_value FROM financial_bids 
         WHERE tender_id = $1 AND vendor_id = $2 
         ORDER BY submitted_at DESC LIMIT 1`,
        [tender_id, req.user.id]
      );

      if (lastBidResult.rows.length > 0) {
        const lastBidValue = parseFloat(lastBidResult.rows[0].total_bid_value);
        const decrement = lastBidValue - totalBidValue;
        
        if (decrement < tender.minimum_decrement_value) {
          return res.status(400).json({ 
            error: `Bid must be at least ${tender.minimum_decrement_value} less than your last bid` 
          });
        }
      }

      await client.query('BEGIN');

      // Get next bid number for this vendor
      const bidCountResult = await client.query(
        'SELECT COUNT(*) as count FROM financial_bids WHERE tender_id = $1 AND vendor_id = $2',
        [tender_id, req.user.id]
      );

      const bidNumber = parseInt(bidCountResult.rows[0].count) + 1;

      // Insert financial bid
      const bidResult = await client.query(
        `INSERT INTO financial_bids (tender_id, vendor_id, bid_number, total_bid_value, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [tender_id, req.user.id, bidNumber, totalBidValue, 'active']
      );

      const bid = bidResult.rows[0];

      // Insert item rates
      for (const itemRate of item_rates) {
        await client.query(
          `INSERT INTO financial_bid_items (financial_bid_id, tender_item_id, basic_rate)
           VALUES ($1, $2, $3)`,
          [bid.id, itemRate.item_id, itemRate.basic_rate]
        );
      }

      // Mark previous bids as outbid
      await client.query(
        `UPDATE financial_bids SET status = $1 
         WHERE tender_id = $2 AND vendor_id = $3 AND id != $4`,
        ['outbid', tender_id, req.user.id, bid.id]
      );

      await client.query('COMMIT');

      // Emit socket event
      const io = req.app.get('io');
      io.to(`tender_${tender_id}`).emit('new_bid', {
        tender_id,
        vendor_name: req.user.name,
        total_bid_value: totalBidValue,
        timestamp: new Date()
      });

      res.status(201).json({
        message: 'Financial bid submitted successfully',
        bid: {
          ...bid,
          total_bid_value: parseFloat(bid.total_bid_value)
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Submit financial bid error:', error);
      res.status(500).json({ error: 'Failed to submit financial bid' });
    } finally {
      client.release();
    }
  }
);

// Get financial bids for a tender (Admin/Convener)
router.get('/financial/:tender_id/all',
  authenticateToken,
  authorizeRoles('admin', 'convener'),
  async (req, res) => {
    try {
      const { tender_id } = req.params;

      const result = await pool.query(
        `SELECT fb.*, u.name as vendor_name, u.company_name
         FROM financial_bids fb
         JOIN users u ON fb.vendor_id = u.id
         WHERE fb.tender_id = $1
         ORDER BY fb.total_bid_value ASC, fb.submitted_at ASC`,
        [tender_id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get financial bids error:', error);
      res.status(500).json({ error: 'Failed to fetch financial bids' });
    }
  }
);

// Get vendor's financial bids for a tender
router.get('/financial/:tender_id/my-bids',
  authenticateToken,
  authorizeRoles('vendor'),
  async (req, res) => {
    try {
      const { tender_id } = req.params;

      const result = await pool.query(
        `SELECT * FROM financial_bids 
         WHERE tender_id = $1 AND vendor_id = $2
         ORDER BY submitted_at DESC`,
        [tender_id, req.user.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Get my financial bids error:', error);
      res.status(500).json({ error: 'Failed to fetch financial bids' });
    }
  }
);

module.exports = router;
