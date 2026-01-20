const pool = require('../db');

exports.getSchedule = async (req, res) => {
  try {
    const { date, classroom_id } = req.query;
    const sql = 'SELECT * FROM schedule WHERE date = ? AND classroom_id = ?';
    const values = [date, classroom_id];

    const [rows] = await pool.query(sql, values);
    res.json(rows);
  } catch (err) {
    console.error('序列 error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};
