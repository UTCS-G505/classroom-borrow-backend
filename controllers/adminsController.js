const pool = require('../db');
const dayjs = require('dayjs');

exports.getAllBookings = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM borrow_requests');
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

function getDatesInRange(startDate, endDate) {
  const date = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();

  if (isNaN(date.getTime()) || isNaN(end.getTime())) return [];

  // 設定為當天 00:00:00 避免時區導致的誤差
  date.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  if (today > date) return [];
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

exports.updateBookings = async (req, res) => {
  // 前端傳來的 status 預期是 'approved' 或 'rejected'
  const { status, reject_reason } = req.body;
  const request_id = req.params.id;

  // 1. 基本參數驗證
  if (!status || (status !== 'approved' && status !== 'rejected')) {
    return res
      .status(400)
      .json({ error: "Status 必須為 'approved' 或 'rejected'" });
  }
  if (status === 'rejected' && !reject_reason) {
    return res.status(400).json({ error: '駁回申請需填寫 reject_reason' });
  }

  // SQL 查詢語句
  const selectRequestSql =
    'SELECT * FROM borrow_requests WHERE request_id = ? FOR UPDATE';

  const updateRequestSql =
    'UPDATE borrow_requests SET status = ?, reject_reason = ? WHERE request_id = ?';

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 2. 查詢該筆申請單
    const [results] = await connection.query(selectRequestSql, [request_id]);
    if (results.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '找不到該筆預約申請' });
    }

    const requestData = results[0];

    // 檢查是否已經處理過
    if (requestData.status === '核准' || requestData.status === '退件') {
      await connection.rollback();
      return res
        .status(400)
        .json({ error: `此申請單已處理過 (${requestData.status})` });
    }

    // 準備更新狀態的邏輯
    const dbStatus = status === 'approved' ? '核准' : '退件';
    const reason = status === 'approved' ? null : reject_reason;

    // 3. 如果是 'approved'，需要檢查衝突
    if (status === 'approved') {
      const sDateRaw = requestData.start_date;
      const eDateRaw = requestData.end_date || requestData.start_date;

      const targetDates = getDatesInRange(sDateRaw, eDateRaw);
      if (targetDates.length === 0) {
        await connection.rollback();
        return res.status(400).json({ error: '日期範圍無效' });
      }

      // 處理時間格式
      const formatTime = (t) => String(t).substring(0, 8);
      const startTimeStr = formatTime(requestData.start_time);
      const endTimeStr = formatTime(requestData.end_time);

      // Check for conflicts in borrow_requests (Approved, Pending, Teacher Approved)
      // Exclude current request itself
      const checkConflictSql = `
          SELECT request_id FROM borrow_requests 
          WHERE classroom_id = ? 
          AND start_date = ? 
          AND status IN ('核准', '已預約', '教師核准', '審核中') 
          AND request_id != ? 
          AND start_time < ? 
          AND end_time > ?
          FOR UPDATE
      `;

      // 檢查所有日期的衝突
      for (const dateStr of targetDates) {
        const [conflicts] = await connection.query(checkConflictSql, [
          requestData.classroom_id,
          dateStr,
          request_id,
          endTimeStr,
          startTimeStr,
        ]);

        if (conflicts.length > 0) {
          await connection.rollback();
          return res.status(409).json({
            error: '該時段已被預約或正在審核中',
            conflictDate: dateStr,
            conflictDetails: conflicts[0],
          });
        }
      }
    }

    // 更新 borrow_requests 狀態
    await connection.query(updateRequestSql, [dbStatus, reason, request_id]);

    await connection.commit();
    res.json({
      success: true,
      message: `已完成: ${dbStatus}`,
      status: dbStatus,
    });
  } catch (err) {
    await connection.rollback();
    console.error('updateBookings error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  } finally {
    connection.release();
  }
};

exports.postAnnouncement = async (req, res) => {
  const { title, content, expired_at } = req.body;

  const missing = [];
  if (!title) missing.push('title');
  if (!content) missing.push('content');
  if (!expired_at) missing.push('expired_at');

  if (missing.length > 0) {
    return res.status(400).json({
      error: `缺少必要欄位: ${missing.join(', ')}`,
    });
  }

  const sql = `
        INSERT INTO announcements (title, content, expired_at)
        VALUES
        (?,?,?)`;
  const values = [title, content, expired_at];

  try {
    const [result] = await pool.query(sql, values);
    res.json({ message: '申請已建立', request_id: result.insertId });
  } catch (err) {
    console.error('新增資料失敗:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.postBlacklist = async (req, res) => {
  const { user_id, reason, expired_at } = req.body;
  const missing = [];

  if (!user_id) missing.push('user_id');
  if (!reason) missing.push('reason');
  if (!expired_at) missing.push('expired_at');

  if (missing.length > 0) {
    return res.status(400).json({
      error: `缺少必要欄位: ${missing.join(', ')}`,
    });
  }

  const sql = `
        INSERT INTO blacklist (user_id, reason, expired_at)
        VALUES
        (?,?,?)`;
  const values = [user_id, reason, expired_at];

  try {
    const [result] = await pool.query(sql, values);
    res.json({ message: '黑名單已更新', request_id: result.insertId });
  } catch (err) {
    console.error('新增資料失敗:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.deleteBlackList = async (req, res) => {
  const sql = `
        DELETE FROM blacklist
        WHERE user_id = ?;`;
  const values = req.params.id;

  try {
    await pool.query(sql, [values]);
    res.json({ message: '黑名單已移除' });
  } catch (err) {
    console.error('新增資料失敗:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};
