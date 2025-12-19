const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Reward rate per second per hash unit (arbitrary simulation)
const REWARD_PER_SEC_PER_HASH = 0.000001; // example units

function toNumber(v) {
  if (v === null || v === undefined) return 0;
  return Number(v);
}

// Get miner status and wallet balance
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const uid = req.user.id;
    const minerRes = await db.query('SELECT * FROM miners WHERE user_id = $1', [uid]);
    const walletRes = await db.query('SELECT * FROM wallets WHERE user_id = $1', [uid]);

    const miner = minerRes.rows[0] || null;
    const wallet = walletRes.rows[0] || { balance: 0 };

    let accrued = 0;
    if (miner && miner.is_active && (miner.last_started || miner.last_claimed)) {
      const since = miner.last_claimed || miner.last_started;
      const seconds = (Date.now() - new Date(since).getTime()) / 1000;
      accrued = seconds * toNumber(miner.hash_rate) * REWARD_PER_SEC_PER_HASH;
    }

    res.json({ miner, wallet, accrued });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get miner status' });
  }
});

// Start miner
router.post('/start', authMiddleware, async (req, res) => {
  const uid = req.user.id;
  try {
    // upsert miner row
    const now = new Date();
    const existing = await db.query('SELECT * FROM miners WHERE user_id = $1', [uid]);
    if (existing.rows.length) {
      await db.query('UPDATE miners SET is_active = true, last_started = $1 WHERE user_id = $2', [now, uid]);
    } else {
      await db.query('INSERT INTO miners (user_id, is_active, last_started, last_claimed) VALUES ($1, true, $2, $2)', [uid, now]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start miner' });
  }
});

// Stop miner and persist accrued rewards
router.post('/stop', authMiddleware, async (req, res) => {
  const uid = req.user.id;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const minerRes = await client.query('SELECT * FROM miners WHERE user_id = $1 FOR UPDATE', [uid]);
    const miner = minerRes.rows[0];
    if (!miner || !miner.is_active) {
      await client.query('COMMIT');
      client.release();
      return res.json({ ok: true, message: 'Miner already stopped' });
    }

    const since = miner.last_claimed || miner.last_started || new Date();
    const seconds = (Date.now() - new Date(since).getTime()) / 1000;
    const accrued = seconds * toNumber(miner.hash_rate) * REWARD_PER_SEC_PER_HASH;

    // ensure wallet exists
    let walletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [uid]);
    if (!walletRes.rows.length) {
      walletRes = await client.query('INSERT INTO wallets (user_id, balance) VALUES ($1, $2) RETURNING *', [uid, accrued]);
    } else {
      const newBal = toNumber(walletRes.rows[0].balance) + accrued;
      await client.query('UPDATE wallets SET balance = $1, updated_at = now() WHERE user_id = $2', [newBal, uid]);
    }

    // stop miner and set last_claimed
    await client.query('UPDATE miners SET is_active = false, last_claimed = now(), last_started = NULL WHERE user_id = $1', [uid]);

    await client.query('COMMIT');
    client.release();
    res.json({ ok: true, accrued });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    console.error(err);
    res.status(500).json({ error: 'Failed to stop miner' });
  }
});

// Claim rewards without stopping miner
router.post('/claim', authMiddleware, async (req, res) => {
  const uid = req.user.id;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const minerRes = await client.query('SELECT * FROM miners WHERE user_id = $1 FOR UPDATE', [uid]);
    const miner = minerRes.rows[0];

    if (!miner) {
      await client.query('COMMIT');
      client.release();
      return res.status(400).json({ error: 'No miner configured' });
    }

    // compute accrued since last_claimed or last_started
    const since = miner.last_claimed || miner.last_started || new Date();
    const seconds = (Date.now() - new Date(since).getTime()) / 1000;
    const accrued = seconds * toNumber(miner.hash_rate) * REWARD_PER_SEC_PER_HASH;

    // ensure wallet exists
    let walletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [uid]);
    if (!walletRes.rows.length) {
      walletRes = await client.query('INSERT INTO wallets (user_id, balance) VALUES ($1, $2) RETURNING *', [uid, accrued]);
    } else {
      const newBal = toNumber(walletRes.rows[0].balance) + accrued;
      await client.query('UPDATE wallets SET balance = $1, updated_at = now() WHERE user_id = $2', [newBal, uid]);
    }

    // update last_claimed to now
    await client.query('UPDATE miners SET last_claimed = now() WHERE user_id = $1', [uid]);

    await client.query('COMMIT');
    client.release();
    res.json({ ok: true, accrued });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    console.error(err);
    res.status(500).json({ error: 'Failed to claim rewards' });
  }
});

module.exports = router;
