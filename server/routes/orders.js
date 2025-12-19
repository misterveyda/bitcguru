const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create an order (buy or sell)
router.post('/', authMiddleware, async (req, res) => {
  const { type, crypto_id, amount, price } = req.body;
  if (!type || !crypto_id || !amount || !price) return res.status(400).json({ error: 'Missing fields' });
  if (!['buy', 'sell'].includes(type)) return res.status(400).json({ error: 'Invalid order type' });

  try {
    const result = await db.query(
      'INSERT INTO orders (user_id, type, crypto_id, amount, price) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.id, type, crypto_id, amount, price]
    );
    res.json({ order: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Order creation failed' });
  }
});

// Get orders — users see their orders; admin sees all
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const result = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
      return res.json({ orders: result.rows });
    }
    const result = await db.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ orders: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

module.exports = router;
