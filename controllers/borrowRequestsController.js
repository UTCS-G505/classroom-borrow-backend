const pool = require('../db');
const dayjs = require('dayjs');

exports.getBookings = (req, res) => {
  const id = req.query.id;
  const sql = 'SELECT * FROM borrow_requests WHERE borrower_id = ? ORDER BY created_at DESC';
    pool.query(sql, id, (err, rows) => {
        if (err) {
          console.error('Query error:', err);
          res.status(500).json({ error: "資料庫錯誤" });
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
          res.status(500).json({ error: "資料庫錯誤" });
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
    
    if (end_time && end_time <= start_time) {
      return res.status(400).json({ error: "結束時間必須晚於開始時間" });
    }

    if (people_count && people_count < 0) {
      return res.status(400).json({ error: "人數不可為負數" });
    }

    //===========================================

    // 1. 準備日期與輸入時間
    // 假設輸入: start_time (a), end_time (b)
    let sDate = dayjs(start_date).format('YYYY-MM-DD');
    let eDate = dayjs(!end_date ? start_date : end_date).format('YYYY-MM-DD');

    // 2. SQL 邏輯：
    // 我們利用 SUBSTRING_INDEX 在查詢當下把 "09:00-10:00" 拆成 "09:00" 和 "10:00"
    // 然後套用重疊公式： (DB起始 < 輸入結束) AND (DB結束 > 輸入起始)
    const checkSql = `
        SELECT *
        FROM schedule
        WHERE classroom_id = ?
          AND date BETWEEN ? AND ?
          AND SUBSTRING_INDEX(time_slot, '-', 1) < ?   -- DB的 A < 輸入的 b
          AND SUBSTRING_INDEX(time_slot, '-', -1) > ?  -- DB的 B > 輸入的 a
    `;

    const chkvalues = [
        classroom_id,
        sDate,       // 日期區間開始
        eDate,       // 日期區間結束
        end_time,    // 輸入的結束時間 (b)，用來跟 DB 的 A 比
        start_time   // 輸入的開始時間 (a)，用來跟 DB 的 B 比
    ];

    pool.query(checkSql, chkvalues, (err, rows) => {
    if (err) {
        console.error('檢查失敗:', err);
        return res.status(500).json({ error: '資料庫檢查錯誤' });
    }

    // 如果抓到資料，代表有「重疊」，也就是衝突
    if (rows.length > 0) {
        // 印出撞到哪一筆
        console.log(`時段衝突！輸入的 ${start_time}~${end_time} 與現有的 ${rows[0].time_slot} 重疊`);
        return res.status(409).json({ error: '該時段已滿，與現有行程衝突' });
    } else {
        console.log('檢查通過，時段可用');    

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

        pool.query(sql,values,(err, result) => {
          if (err) {
            console.error('新增資料失敗:', err);
            return res.status(500).json({ error: '資料庫錯誤' });
          }
          res.json({ message: '申請已建立', request_id: result.insertId });
        });

    }
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