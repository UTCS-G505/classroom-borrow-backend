const pool = require('../db');

exports.getBookings = (req, res) => {
  const id = req.query.id;
  const sql = 'SELECT * FROM borrow_requests WHERE borrower_id = ? ORDER BY created_at DESC';
    pool.query(sql, id, (err, rows) => {
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
    var 
    {
      borrower_id,
      classroom_id,
      borrow_type,
      start_date,
      end_date,
      start_time,
      end_time,
      event_name,
      people_count,
      teacher_name,
      reason,
      teacher_department, 
      teacher_phone, 
      teacher_email,
      borrower_department, 
      borrower_phone, 
      borrower_email
    } = req.body;
    const time_slot = `${start_time}-${end_time}`;

    const missing = [];
    if (!borrower_id) missing.push('borrower_id');
    if (!classroom_id) missing.push('classroom_id');
    if (!borrow_type) missing.push('borrow_type');
    if (!start_date) missing.push('start_date');
    if (!start_time) missing.push('start_time');
    if (!event_name) missing.push('event_name');

    if (missing.length > 0) {
      return res.status(400).json({
        error: `缺少必要欄位: ${missing.join(', ')}`
      });
    }
    
    /*
    if ( !classroom_id || !borrow_type || !start_date || !start_time || !end_time || !event_name ) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }
    */

    //===========================================
    const dayjs = require('dayjs');

    // 假設 start_date = '2025-11-05', end_date = '2025-11-10'
    let start = dayjs(start_date);
    let end = dayjs( (!end_date) ? start_date : end_date);

    
    for (let d = start; d.isBefore(end) || d.isSame(end); d = d.add(1, 'day')) {
      const checkSql = `
        SELECT *
        FROM schedule
        WHERE classroom_id = ?
          AND date = ?
          AND time_slot = ?
      `;

      const values = [
        classroom_id,
        d.format('YYYY-MM-DD'),
        time_slot // 組合成字串去比對
      ];

      pool.query(checkSql, values, (err, rows) => {
        if (err) {
          console.error('檢查失敗:', err);
          return;
        }

        if (rows.length > 0) {
          console.log(`日期 ${d.format('YYYY-MM-DD')} 時段已被占用`);
          return res.status(500).json({ error: '時段已滿' });
        } else {
          console.log(`日期 ${d.format('YYYY-MM-DD')} 可用`);
        }
      });
    }

    //===========================================

    
    if ( !teacher_department )  teacher_department = "";
    if ( !teacher_phone )  teacher_phone = "";
    if ( !teacher_email )  teacher_email = "";
    if ( !borrower_department )  borrower_department = "";
    if ( !borrower_phone )  borrower_phone = "";
    if ( !borrower_email )  borrower_email = "";

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
    //const testid = 4;
    const values = 
    [
      borrower_id,
      classroom_id, 
      borrow_type, 
      start_date, 
      end_date,
      start_time, 
      end_time,
      event_name, 
      people_count, 
      teacher_name, 
      reason, 
      '審核中', 
      "審核中",
      teacher_department, 
      teacher_phone, 
      teacher_email,
      borrower_department, 
      borrower_phone, 
      borrower_email
    ]


    
    var req_id;

    pool.query(sql,values,(err, result) => {
      if (err) {
        console.error('新增資料失敗:', err);
        return res.status(500).json({ error: '資料庫錯誤' });
      }
      req_id = result.insertId;
      res.json({ message: '申請已建立', request_id: result.insertId });
    });

  

}

exports.putCancelBookings = (req, res) => {
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

exports.putReturnBookings = (req, res) => {
    const sql = `
    UPDATE borrow_requests
    SET status = '已歸還'
    WHERE request_id = ?;`
   
    const value = req.params.id;
    pool.query(sql,value,(err, result) => {
      if (err) {
        console.error('變更資料失敗:', err);
        return res.status(500).json({ error: '資料庫錯誤' });
      }
      res.json({ message: '已歸還', request_id: result.insertId });
      //console.log(result);
    });
}