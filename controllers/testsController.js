const pool = require('../db');

exports.test1 = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM classrooms');
    res.json({ message: '測試1', result: rows[0] });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.test2 = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM schedule');
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.test3 = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM borrow_requests');
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};
