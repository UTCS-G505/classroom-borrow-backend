const pool = require('../db');

exports.test1 = (req, res) => {
    pool.query(`SELECT * FROM classrooms `, (err, rows) => {
      if (err) {
        console.error('Query error:', err);
      } else {
        res.json({ message: '測試1', result: rows[0] });
      }
    });
    
}


exports.test2 = (req, res) => {
    pool.query(`SELECT * FROM schedule `, (err, rows) => {
      if (err) {
        console.error('Query error:', err);
      } else {
        res.json(rows);
      }
    });
}

exports.test3 = (req, res) => {
    pool.query('SELECT * FROM borrow_requests', (err, rows) => {
      if (err) {
        console.error('Query error:', err);
      } else {
        res.json(rows);
      }
    });
}