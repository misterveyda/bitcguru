const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  user: process.env.DATABASE_USER || 'pguser',
  password: process.env.DATABASE_PASSWORD || 'pgpass',
  database: process.env.DATABASE_NAME || 'bitcguru_db'
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
