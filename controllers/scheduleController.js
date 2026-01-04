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
            console.error('序列 error:', err);
            res.status(500).json({ error: "資料庫錯誤" });
        } else {
            res.json(rows);
        }
    });
    //*/
};