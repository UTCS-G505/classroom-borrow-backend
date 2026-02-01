const pool = require('../db');

exports.getSchedule = async (req, res) => {
  try {
    const { date, start_date, end_date, classroom_id } = req.query;
    let sql;
    let values;

    if (start_date && end_date) {
      sql =
        'SELECT * FROM schedule WHERE date >= ? AND date <= ? AND classroom_id = ?';
      values = [start_date, end_date, classroom_id];
    } else {
      sql = 'SELECT * FROM schedule WHERE date = ? AND classroom_id = ?';
      values = [date, classroom_id];
    }

    const [rows] = await pool.query(sql, values);
    res.json(rows);
  } catch (err) {
    console.error('序列 error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};
