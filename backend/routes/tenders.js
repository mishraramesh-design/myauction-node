const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const config = require('../config/config');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Create Tender (NIT-RA)
router.post('/',
  authenticateToken,
  authorizeRoles('admin', 'convener'),
  [
    body('title').trim().notEmpty(),
    body('description').trim().notEmpty(),
    body('techno_closing_date').isISO8601(),
    body('techno_opening_date').isISO8601(),
    body('items').isArray({ min: 1 })
  ],
  async (req, res) => {
    const client = await pool.connect();
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title, description, techno_closing_date, techno_opening_date,
        financial_bidding_start, financial_bidding_end,
        earnest_money_deposit, estimated_value, delivery_period,
        delivery_schedule, pre_bid_conference, pre_bid_date,
        payment_exemption, payment_terms, instructions, terms_of_price,
        minimum_decrement_value, items, consignees
      } = req.body;

      // Validate max items
      const maxItems = config.tender.maxItemsPerTender;
      if (items.length > maxItems) {
        return res.status(400).json({ 
          error: `Maximum ${maxItems} items allowed per tender (configurable)` 
        });
      }

      await client.query('BEGIN');

      // Generate tender number
      const tenderNumber = `NIT-RA-${Date.now()}`;

      // Create tender
      const tenderResult = await client.query(
        `INSERT INTO tenders (
          tender_number, title, description, 
          bidding_system, tender_type, evaluation_criteria,
          techno_closing_date, techno_opening_date,
          financial_bidding_start, financial_bidding_end,
          earnest_money_deposit, estimated_value, delivery_period,
          delivery_schedule, pre_bid_conference, pre_bid_date,
          payment_exemption, payment_terms, instructions, terms_of_price,
          minimum_decrement_value, created_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING *`,
        [
          tenderNumber, title, description,
          config.tender.biddingSystem, config.tender.tenderType, config.tender.evaluationCriteria,
          techno_closing_date, techno_opening_date,
          financial_bidding_start, financial_bidding_end,
          earnest_money_deposit, estimated_value, delivery_period,
          delivery_schedule, pre_bid_conference, pre_bid_date,
          payment_exemption, payment_terms, instructions, terms_of_price,
          minimum_decrement_value, req.user.id, 'draft'
        ]
      );

      const tender = tenderResult.rows[0];

      // Add items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemResult = await client.query(
          `INSERT INTO tender_items (tender_id, item_number, item_description, quantity, unit, specifications)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [tender.id, i + 1, item.description, item.quantity, item.unit, item.specifications]
        );

        // Add consignees for this item if provided
        if (consignees && consignees[i]) {
          for (const consignee of consignees[i]) {
            await client.query(
              `INSERT INTO tender_consignees (tender_id, tender_item_id, consignee_name, consignee_address, delivery_quantity)
               VALUES ($1, $2, $3, $4, $5)`,
              [tender.id, itemResult.rows[0].id, consignee.name, consignee.address, consignee.quantity]
            );
          }
        }
      }

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Tender created successfully',
        tender: tender
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create tender error:', error);
      res.status(500).json({ error: 'Failed to create tender' });
    } finally {
      client.release();
    }
  }
);

// Get all tenders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, role } = req.query;
    let query = 'SELECT t.*, u.name as creator_name FROM tenders t JOIN users u ON t.created_by = u.id';
    const params = [];

    if (status) {
      query += ' WHERE t.status = $1';
      params.push(status);
    }

    query += ' ORDER BY t.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get tenders error:', error);
    res.status(500).json({ error: 'Failed to fetch tenders' });
  }
});

// Get tender by ID with items
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get tender
    const tenderResult = await pool.query(
      'SELECT t.*, u.name as creator_name FROM tenders t JOIN users u ON t.created_by = u.id WHERE t.id = $1',
      [id]
    );

    if (tenderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tender not found' });
    }

    const tender = tenderResult.rows[0];

    // Get items
    const itemsResult = await pool.query(
      'SELECT * FROM tender_items WHERE tender_id = $1 ORDER BY item_number',
      [id]
    );

    // Get consignees for each item
    const items = [];
    for (const item of itemsResult.rows) {
      const consigneesResult = await pool.query(
        'SELECT * FROM tender_consignees WHERE tender_item_id = $1',
        [item.id]
      );
      items.push({
        ...item,
        consignees: consigneesResult.rows
      });
    }

    res.json({
      ...tender,
      items
    });
  } catch (error) {
    console.error('Get tender error:', error);
    res.status(500).json({ error: 'Failed to fetch tender' });
  }
});

// Publish tender
router.put('/:id/publish',
  authenticateToken,
  authorizeRoles('admin', 'convener'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'UPDATE tenders SET status = $1, publish_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status = $3 RETURNING *',
        ['published', id, 'draft']
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Tender not found or already published' });
      }

      res.json({
        message: 'Tender published successfully',
        tender: result.rows[0]
      });
    } catch (error) {
      console.error('Publish tender error:', error);
      res.status(500).json({ error: 'Failed to publish tender' });
    }
  }
);

// Update tender status
router.put('/:id/status',
  authenticateToken,
  authorizeRoles('admin', 'convener'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const result = await pool.query(
        'UPDATE tenders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Tender not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Update tender status error:', error);
      res.status(500).json({ error: 'Failed to update tender status' });
    }
  }
);

module.exports = router;
