const bcrypt = require('bcrypt');
const db = require('../db');

async function seed() {
  try {
    const password = 'adminpass';
    const hash = await bcrypt.hash(password, 10);
    const existing = await db.query('SELECT id FROM users WHERE email = $1', ['admin@example.com']);
    if (existing.rows.length) {
      console.log('Admin already exists');
      process.exit(0);
    }

    const res = await db.query('INSERT INTO users (email, password_hash, role) VALUES ($1,$2,$3) RETURNING id', ['admin@example.com', hash, 'admin']);
    console.log('Created admin user id=', res.rows[0].id, 'password=adminpass');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
