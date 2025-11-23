const pool = require('../db');

exports.getAllAnnouncements = (req, res) => {
    pool.query(`SELECT * FROM announcements ORDER BY announcement_id DESC`, (err, rows) => {
      if (err) {
        console.error('Query error:', err);
      } else {
        res.json(rows)
      }
    });
}

exports.getAnnouncementsByid = (req, res) => {
    const value = req.params.id;
    const sql = 'SELECT * FROM announcements WHERE announcement_id = ?';
    pool.query(sql, value, (err, rows) => {
        if (err) {
          console.error('Query error:', err);
          res.status(500).send('Database error');
        } else {
          res.json(rows);
        }
    });  
}
