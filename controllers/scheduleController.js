const pool = require('../db');

exports.getSchedule = (req, res) => {
    //console.log("Test");
    //res.json({test:"test"}); // 確認有進來
    //*
    const { date, classroom_id } = req.query;
    const sql = 'SELECT * FROM schedule WHERE date = ? AND classroom_id = ?';
    const values = [date, classroom_id];

    pool.query(sql, values, (err, rows) => {
        if (err) {
            console.error('Query error:', err);
            res.status(500).send('Database error');
        } else {
            res.json(rows);
        }
    });
    //*/
};