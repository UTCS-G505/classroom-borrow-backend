require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'classroom_borrow_system',
    port: process.env.DB_PORT || 3307,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  try {
    const connection = await pool.getConnection();
    console.log('Connected to database.');

    // 1. Add column if not exists
    try {
      await connection.query(`
        ALTER TABLE borrow_requests 
        ADD COLUMN borrower_name VARCHAR(255) AFTER user_id
      `);
      console.log('Added borrower_name column.');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('Column borrower_name already exists.');
      } else {
        throw err;
      }
    }

    // 2. Backfill data from users table
    const [result] = await connection.query(`
      UPDATE borrow_requests br
      JOIN users u ON br.user_id = u.user_id
      SET br.borrower_name = u.name
      WHERE br.borrower_name IS NULL
    `);
    console.log(`Backfilled ${result.changedRows} rows.`);

    connection.release();
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    pool.end();
  }
}

migrate();
