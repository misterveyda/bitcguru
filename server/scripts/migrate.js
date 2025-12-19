const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigrations() {
  const migDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const full = path.join(migDir, file);
    console.log('Running', file);
    const sql = fs.readFileSync(full, 'utf8');
    try {
      await db.query(sql);
      console.log('OK', file);
    } catch (err) {
      console.error('Failed', file, err.message);
      process.exit(1);
    }
  }
  console.log('Migrations complete');
  process.exit(0);
}

runMigrations();
