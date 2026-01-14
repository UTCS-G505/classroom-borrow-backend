const pool = require('../db');

exports.getAllAnnouncements = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM announcements ORDER BY announcement_id DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.getAnnouncementsById = async (req, res) => {
  try {
    const value = req.params.id;
    const sql = 'SELECT * FROM announcements WHERE announcement_id = ?';
    const [rows] = await pool.query(sql, [value]);
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};
