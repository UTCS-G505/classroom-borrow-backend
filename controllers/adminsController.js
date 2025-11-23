const pool = require('../db');

exports.getAllBookings = (req, res) => {
    pool.query(`SELECT * FROM borrow_requests`, (err, rows) => {
      if (err) {
        console.error('Query error:', err);
      } else {
        //console.log(rows);
        res.json(rows)
      }
    });
}
exports.updateBookings = (req, res) => {
    const sql = `
        UPDATE borrow_requests
        SET status = ?,
        reject_reason = ?
        WHERE request_id = ?;`
    const {
        status,
        reject_reason
    } = req.body;
    const value = [status,reject_reason,req.params.id];
    pool.query(sql,value,(err, result) => {
      if (err) {
        console.error('變更資料失敗:', err);
        return res.status(500).json({ error: '資料庫錯誤' });
      }
      res.json({ message: '已審核', request_id: result.insertId });
    });
}
exports.postAnnouncement = (req, res) => {
    const {
        title,
        content, 
        expired_at
    } = req.body;

    // 簡單驗證
    if (!title || !content || !expired_at ) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }

    // SQL INSERT
  const sql = `
        INSERT INTO announcements (title, content, expired_at)
        VALUES
        (?,?,?)`
    const values = 
    [
        title,
        content, 
        expired_at
    ]
    
    pool.query(sql,values,(err, result) => {
      if (err) {
        console.error('新增資料失敗:', err);
        return res.status(500).json({ error: '資料庫錯誤' });
      }
      res.json({ message: '申請已建立', request_id: result.insertId });
    });
}
exports.postBlacklist = (req, res) => {
    const {
      user_id,
      reason, 
      expired_at
    } = req.body;

    // 簡單驗證
    if (!user_id || !reason || !expired_at ) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }

    // SQL INSERT
  const sql = `
        INSERT INTO blacklist (user_id, reason, expired_at)
        VALUES
        (?,?,?)`
    const values = 
    [
        user_id,
        reason, 
        expired_at
    ]
    
    pool.query(sql,values,(err, result) => {
      if (err) {
        console.error('新增資料失敗:', err);
        return res.status(500).json({ error: '資料庫錯誤' });
      }
      res.json({ message: '黑名單已更新', request_id: result.insertId });
    });
}
exports.deleteBlackList = (req, res) => {
    const sql = `
        DELETE FROM blacklist
        WHERE user_id = ?;`
    const values = req.params.id;

    
    pool.query(sql,values,(err, result) => {
      if (err) {
        console.error('新增資料失敗:', err);
        return res.status(500).json({ error: '資料庫錯誤' });
      }
      res.json({ message: '黑名單已更新', request_id: result.insertId });
    });
}