const pool = require('../db');

exports.getBookings = (req, res) => {
    const value = req.body.id;
    //const value = 1;
    const sql = 'SELECT * FROM borrow_requests WHERE borrower_id = ? ORDER BY created_at DESC';
    pool.query(sql, value, (err, rows) => {
        if (err) {
          console.error('Query error:', err);
          res.status(500).send('Database error');
        } else {
          res.json(rows);
        }
    });
}

exports.getBookingssByid = (req, res) => {
    const value = req.params.id;
    const sql = 'SELECT * FROM borrow_requests WHERE request_id = ?';
    pool.query(sql, value, (err, rows) => {
        if (err) {
          console.error('Query error:', err);
          res.status(500).send('Database error');
        } else {
          res.json(rows);
        }
    });  
}


exports.postBookings = (req, res) => {
    const 
    {
      classroom_id,
      borrow_type,
      start_date,
      start_time,
      end_time,
      event_name,
      people_count,
      teacher_name,
      reason
    } = req.body;


    if ( !classroom_id || !borrow_type || !start_date || !start_time || !end_time || !event_name ) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }

    // SQL INSERT
    const sql = `
        INSERT INTO borrow_requests (
        borrower_id, classroom_id, borrow_type, start_date, end_date,
        start_time, end_time, event_name, people_count, 
        teacher_name, reason, status, reject_reason,
        teacher_department, teacher_phone, teacher_email,
        borrower_department, borrower_phone, borrower_email
        ) VALUES (
        ? , ? , ? , ? , ? , 
        ? , ? , ? , ? ,
        ? , ? , ? , ? ,
        ? , ? , ? ,
        ? , ? , ? )`
    const testid = 4;
    const values = 
    [
      testid,
      classroom_id, 
      borrow_type, 
      start_date, 
      null, 
      start_time, 
      end_time,
      event_name, 
      people_count, 
      teacher_name, 
      reason, 
      '審核中', 
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]
    
    pool.query(sql,values,(err, result) => {
      if (err) {
        console.error('新增資料失敗:', err);
        return res.status(500).json({ error: '資料庫錯誤' });
      }
      res.json({ message: '申請已建立', request_id: result.insertId });
    });
}

exports.postCancelBookings = (req, res) => {
    const sql = `
    UPDATE borrow_requests
    SET status = '已取消'
    WHERE request_id = ?;`
   
    const value = req.params.id;
    pool.query(sql,value,(err, result) => {
      if (err) {
        console.error('變更資料失敗:', err);
        return res.status(500).json({ error: '資料庫錯誤' });
      }
      res.json({ message: '已取消', request_id: result.insertId });
      //console.log(result);
    });
}