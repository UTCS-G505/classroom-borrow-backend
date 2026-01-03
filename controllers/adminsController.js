const pool = require('../db');
const dayjs = require('dayjs');

exports.getAllBookings = (req, res) => {
    pool.query(`SELECT * FROM borrow_requests`, (err, rows) => {
      if (err) {
        console.error('Query error:', err);
      } else {
        res.json(rows)
      }
    });
}
// 輔助函式：取得日期範圍內的所有日期字串 (YYYY-MM-DD)
function getDatesInRange(startDate, endDate) {
    const date = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(date.getTime()) || isNaN(end.getTime())) return [];

    // 設定為當天 00:00:00 避免時區導致的誤差
    date.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (end < date) return [];

    const dateList = [];
    while (date <= end) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dateList.push(`${year}-${month}-${day}`);
        date.setDate(date.getDate() + 1);
    }
    return dateList;
}

exports.updateBookings = (req, res) => {
    // 前端傳來的 status 預期是 'approved' 或 'rejected'
    const { status, reject_reason } = req.body;
    const request_id = req.params.id;

    // 1. 基本參數驗證
    if (!status || (status !== 'approved' && status !== 'rejected')) {
        return res.status(400).json({ error: "Status 必須為 'approved' 或 'rejected'" });
    }
    if (status === 'rejected' && !reject_reason) {
        return res.status(400).json({ error: "駁回申請需填寫 reject_reason" });
    }

    // SQL 查詢語句
    const selectRequestSql = 'SELECT * FROM borrow_requests WHERE request_id = ?';
    
    // 更新申請單狀態 (ENUM: '核准', '退件', ...)
    const updateRequestSql = 'UPDATE borrow_requests SET status = ?, reject_reason = ? WHERE request_id = ?';
    
    // 檢查衝突 (檢查 schedule 表 檢查同一間教室、同一天，且時間重疊的紀錄)
    // 時間重疊 = (已存開始 < 新結束) AND (已存結束 > 新開始)
    // 使用 SUBSTRING_INDEX 切割字串比對
    const checkConflictSql = `
        SELECT * FROM schedule 
        WHERE classroom_id = ? 
          AND date = ? 
          AND SUBSTRING_INDEX(time_slot, '-', 1) < ? 
          AND SUBSTRING_INDEX(time_slot, '-', -1) > ?
          AND status = '已預約'
    `;

    // 寫入排程 (ENUM: '已預約')
    // 維持寫入 time_slot (格式為 HH:MM:SS-HH:MM:SS)
    const insertScheduleSql = `
        INSERT INTO schedule (classroom_id, date, time_slot, booked_by, borrow_request_id, event_name, status)
        VALUES ?
    `;

    // 2. 查詢該筆申請單
    pool.query(selectRequestSql, [request_id], (err, results) => {
        if (err) return res.status(500).json({ error: '資料庫錯誤' });
        if (results.length === 0) return res.status(404).json({ error: '找不到該筆預約申請' });

        const requestData = results[0];

        // 檢查是否已經處理過 (比對中文 ENUM)
        if (requestData.status === '核准' || requestData.status === '退件') {
            return res.status(400).json({ error: `此申請單已處理過 (${requestData.status})` });
        }

        // 定義狀態更新函式 (最後一步驟)
        const performStatusUpdate = () => {
            // 轉換前端 status 為資料庫中文 ENUM
            const dbStatus = status === 'approved' ? '核准' : '退件';
            const reason = status === 'approved' ? null : reject_reason;

            pool.query(updateRequestSql, [dbStatus, reason, request_id], (err) => {
                if (err) return res.status(500).json({ error: '資料庫錯誤 (Update Status)' });
                res.json({ success: true, message: `已完成: ${dbStatus}`, status: dbStatus });
            });
        };

        // 3. 如果是 'approved'，需要檢查衝突並寫入 schedule
        if (status === 'approved') {
            // 取得日期範圍 (end_date 若為 NULL 則視為單日)
            const sDateRaw = requestData.start_date;
            const eDateRaw = requestData.end_date || requestData.start_date;

            const targetDates = getDatesInRange(sDateRaw, eDateRaw);
            if (targetDates.length === 0) return res.status(400).json({ error: '日期範圍無效' });

            // 處理時間格式 (MySQL TIME 可能是 "13:00:00")
            // 修改處：將 substring(0, 5) 改為 substring(0, 8) 以保留秒數 (HH:MM:SS)
            const formatTime = (t) => String(t).substring(0, 8); 
            const startTimeStr = formatTime(requestData.start_time);
            const endTimeStr = formatTime(requestData.end_time);

            // 檢查所有日期的衝突 (這裡使用 Promise.all 來處理非同步迴圈查詢)
            const checkPromises = targetDates.map(dateStr => {
                return new Promise((resolve, reject) => {
                    pool.query(checkConflictSql, [
                        requestData.classroom_id,
                        dateStr,
                        endTimeStr,   // New End Time (HH:MM:SS)
                        startTimeStr  // New Start Time (HH:MM:SS)
                    ], (err, conflicts) => {
                        if (err) reject(err);
                        else resolve({ date: dateStr, conflicts });
                    });
                });
            });

            Promise.all(checkPromises)
                .then(results => {
                    // 過濾出有衝突的日期
                    const conflictResult = results.find(r => r.conflicts.length > 0);
                    
                    if (conflictResult) {
                        return res.status(409).json({ 
                            error: '該時段已被預約', 
                            conflictDate: conflictResult.date,
                            conflictDetails: conflictResult.conflicts[0] 
                        });
                    }

                    // 無衝突，準備寫入 schedule
                    // 修改後格式範例： "13:00:00-15:00:00"
                    const timeSlotString = `${startTimeStr}-${endTimeStr}`;
                    const scheduleStatus = '已預約'; // 對應 schedule 表的 ENUM

                    // 準備批量插入的資料陣列
                    const valuesToInsert = targetDates.map(dateStr => [
                        requestData.classroom_id,
                        dateStr,
                        timeSlotString,
                        requestData.borrower_id, // 對應 users 表 user_id
                        request_id,
                        requestData.event_name,
                        scheduleStatus
                    ]);

                    pool.query(insertScheduleSql, [valuesToInsert], (err) => {
                        if (err) {
                            console.error('寫入排程失敗:', err);
                            return res.status(500).json({ error: '寫入排程失敗', db_error: err.message });
                        }
                        // 寫入成功後，更新 borrow_requests 狀態
                        performStatusUpdate();
                    });
                })
                .catch(err => {
                    return res.status(500).json({ error: '檢查衝突時發生錯誤'});
                });

        } else {
            // 如果是 rejected，直接更新狀態即可
            performStatusUpdate();
        }
    });
};
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