const pool = require('../db');

exports.getAllBookings = (req, res) => {
    pool.query(`SELECT * FROM borrow_requests`, (err, rows) => {
      if (err) {
        console.error('Query error:', err);
      } else {
        res.json(rows)
      }
    });
}
exports.updateBookings = (req, res) => {
    const {
        status,
        reject_reason
    } = req.body;
    const request_id = req.params.id

    if ( !status )
    {
      return res.status(400).json({
        error: `缺少必要欄位: status`
      });
    }
    if ( status != 'approve' && !reject_reason )
    {
      return res.status(400).json({
        error: `缺少必要欄位: reject_reason`
      });
    }

    const updateSql = `
        UPDATE borrow_requests
        SET status = ?,
        reject_reason = ?
        WHERE request_id = ?;`
    const selectRequestSql = 'SELECT * FROM borrow_requests WHERE request_id = ?';
    const checkConflictSql = `
        SELECT * FROM schedule 
        WHERE classroom_id = ? 
        AND borrow_date = ?
        AND (start_time < ? AND end_time > ?)
    `;
    const insertScheduleSql = `
        INSERT INTO schedule (classroom_id, borrow_date, start_time, end_time, request_id, title)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    /*
    const updateStatusSql = `
        UPDATE borrow_requests
        SET status = ?, reject_reason = ?
        WHERE request_id = ?
    `;
    */
        console.log([status,reject_reason,request_id]);

    //查詢原始申請資料
    pool.query(selectRequestSql, [request_id], (err, results) => {
        if (err) {
            console.error('查詢申請失敗:', err);
            return res.status(500).json({ error: '資料庫錯誤' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: '找不到該筆預約申請' });
        }

        const requestData = results[0];

        // 定義最後更新狀態的函式 (避免重複寫程式碼)
        const performStatusUpdate = () => {
            pool.query(updateSql, [status, reject_reason, request_id], (err, result) => {
                if (err) {
                    console.error('更新狀態失敗:', err);
                    // 注意：如果前面已經寫入 schedule 但這裡失敗，會導致資料不一致 (這是 callback 寫法的風險之一)
                    return res.status(500).json({ error: '資料庫錯誤' });
                }
                res.json({ message: '已審核', request_id: request_id, status: status });
            });
        };

        // --- 判斷邏輯 ---
        if (status === 'approve') {
            // 如果是核准，必須先檢查 schedule
            // --- 第二層：檢查衝突 ---
            pool.query(checkConflictSql, [
                requestData.classroom_id,
                requestData.borrow_date,
                requestData.end_time,   // 現有開始 < 新結束
                requestData.start_time  // 現有結束 > 新開始
            ], (err, conflicts) => {
                if (err) {
                    console.error('檢查衝突失敗:', err);
                    return res.status(500).json({ error: '資料庫錯誤' });
                }

                if (conflicts.length > 0) {
                    return res.status(409).json({ 
                        error: '該時段已被預約，無法核准', 
                        conflict: conflicts[0] 
                    });
                }

                // --- 第三層：寫入 Schedule ---
                // 標題可以用 requestData.purpose 或自訂
                const scheduleTitle = `預約借用 - ${requestData.user_id || 'User'}`; 
                
                pool.query(insertScheduleSql, [
                    requestData.classroom_id,
                    requestData.borrow_date,
                    requestData.start_time,
                    requestData.end_time,
                    request_id,
                    scheduleTitle
                ], (err, insertResult) => {
                    if (err) {
                        console.error('寫入排程失敗:', err);
                        return res.status(500).json({ error: '資料庫錯誤' });
                    }
                    
                    // 寫入成功後，執行第四層：更新狀態
                    performStatusUpdate();
                });
            });

        } else {
            // 如果是 reject (駁回)，直接更新狀態，不需要操作 schedule
            performStatusUpdate();
        }
    });
    
    
    
    /*
    const value = [status,reject_reason,req.params.id];
    pool.query(sql,value,(err, result) => {
      if (err) {
        console.error('變更資料失敗:', err);
        return res.status(500).json({ error: '資料庫錯誤' });
      }
      res.json({ message: '已審核', request_id: result.insertId });
    });
    */
}


exports.postAnnouncement = (req, res) => {
    const {
        title,
        content, 
        expired_at
    } = req.body;

    const missing = [];
    if (!title) missing.push('title');
    if (!content) missing.push('content');
    if (!expired_at) missing.push('expired_at');

    if (missing.length > 0) {
      return res.status(400).json({
        error: `缺少必要欄位: ${missing.join(', ')}`
      });
    }
    /*
    // 簡單驗證
    if (!title || !content || !expired_at ) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }
      */

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
    const missing = [];

    if (!user_id) missing.push('user_id');
    if (!reason) missing.push('reason');
    if (!expired_at) missing.push('expired_at');

    if (missing.length > 0) {
      return res.status(400).json({
        error: `缺少必要欄位: ${missing.join(', ')}`
      });
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
      res.json({ message: '黑名單已移除' });
    });
}