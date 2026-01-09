// db.js
require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'classroom_borrow_system',
  port: process.env.DB_PORT || 3307,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  queueLimit: 0,
  charsetNumber: 45,
});

// Export promise-based pool for async/await usage
module.exports = pool.promise();
