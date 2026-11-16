const pool = require('../db');
const dayjs = require('dayjs');
const crypto = require('crypto');
const emailService = require('../services/emailService');
const { VALID_CLASSROOMS, VENUE_IDS } = require('../utils/constants');
const { validateFieldLengths } = require('../utils/fieldLimits');
const { expandOccurrences } = require('../utils/occurrences');
const { findBookingConflict } = require('../utils/bookingConflicts');

exports.getAllBookings = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM borrow_requests');
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.getAllBlacklist = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.*, u.name as user_name, u.email as user_email
      FROM blacklist b
      LEFT JOIN users u ON b.user_id = u.user_id
      ORDER BY b.created_at DESC
    `);
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

    if (status === 'approved') {
      try {
        await emailService.sendApprovalNotification({
          userEmail: requestData.borrower_email,
          borrowId: requestData.request_id,
          eventName: requestData.event_name,
          classroom: requestData.classroom_id,
          startDate: requestData.start_date,
          endDate: requestData.end_date,
          startTime: requestData.start_time,
          endTime: requestData.end_time,
          comment: null,
        });
      } catch (emailError) {
        console.error('核准通知信寄送失敗:', emailError);
      }
    }

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

// ---------- 管理員依「場地及設備租借表」代為新增借用 ----------

const ADMIN_BOOKABLE_VENUES = new Set([...VALID_CLASSROOMS, ...VENUE_IDS]);
const MAX_ADMIN_BOOKINGS = 20; // 單次最多登錄幾筆（租借表一個場地一頁）
const MAX_REASON_LENGTH = 2000;
const MAX_RANGE_DAYS = 366;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+$/;

function trimmed(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// 'YYYY-MM-DD' 且為真實存在的日期（2026-02-30 這類會被拒絕）
function parseIsoDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  const date = dayjs(value);
  return date.isValid() && date.format('YYYY-MM-DD') === value ? date : null;
}

// 'HH:MM' 或 'HH:MM:SS' → 'HH:MM:SS'，方便字串比較與寫入 TIME 欄位
function normalizeTime(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(TIME_RE);
  return match ? `${match[1]}:${match[2]}:${match[3] || '00'}` : null;
}

/**
 * 驗證並整理單筆借用資料。
 * @returns {{booking: object} | {error: string}}
 */
function normalizeAdminBooking(input) {
  if (!input || typeof input !== 'object') return { error: '資料格式錯誤' };

  const classroom_id = trimmed(input.classroom_id);
  const event_name = trimmed(input.event_name);
  const borrower_department = trimmed(input.borrower_department);
  const borrower_name = trimmed(input.borrower_name);
  const borrower_phone = trimmed(input.borrower_phone);
  const borrower_email = trimmed(input.borrower_email);
  const reason = trimmed(input.reason);

  const missing = [];
  if (!classroom_id) missing.push('classroom_id');
  if (!input.start_date) missing.push('start_date');
  if (!input.start_time) missing.push('start_time');
  if (!input.end_time) missing.push('end_time');
  if (!event_name) missing.push('event_name');
  if (!borrower_department) missing.push('borrower_department');
  if (!borrower_name) missing.push('borrower_name');
  if (missing.length > 0) {
    return { error: `缺少必要欄位: ${missing.join(', ')}` };
  }

  if (!ADMIN_BOOKABLE_VENUES.has(classroom_id)) {
    return { error: '無效的場地代號' };
  }

  const start = parseIsoDate(input.start_date);
  if (!start) return { error: '借用日期格式錯誤（需為 YYYY-MM-DD）' };
  if (start.isBefore(dayjs().startOf('day'))) {
    return { error: '借用日期不可早於今天' };
  }

  const borrow_type = input.borrow_type || '單次借用';
  if (borrow_type !== '單次借用' && borrow_type !== '多次借用') {
    return { error: '借用類型必須為「單次借用」或「多次借用」' };
  }

  let repeat_frequency = null;
  let end_date = null;
  if (borrow_type === '多次借用') {
    if (
      input.repeat_frequency !== '每天' &&
      input.repeat_frequency !== '每周'
    ) {
      return { error: '多次借用需指定重複頻率（每天或每周）' };
    }
    const end = parseIsoDate(input.end_date);
    if (!end) return { error: '多次借用需填寫正確的結束日期' };
    if (end.isBefore(start)) return { error: '結束日期不可早於借用日期' };
    if (end.diff(start, 'day') >= MAX_RANGE_DAYS) {
      return { error: '借用期間不可超過一年' };
    }
    repeat_frequency = input.repeat_frequency;
    end_date = end.format('YYYY-MM-DD');
  }

  const start_time = normalizeTime(input.start_time);
  const end_time = normalizeTime(input.end_time);
  if (!start_time || !end_time) {
    return { error: '時間格式錯誤（需為 HH:MM）' };
  }
  if (end_time <= start_time) {
    return { error: '結束時間必須晚於開始時間' };
  }

  let people_count = null;
  if (
    input.people_count !== undefined &&
    input.people_count !== null &&
    input.people_count !== ''
  ) {
    const count = Number(input.people_count);
    if (!Number.isInteger(count) || count < 0) {
      return { error: '人數必須為不小於 0 的整數' };
    }
    people_count = count;
  }

  if (borrower_email && !EMAIL_RE.test(borrower_email)) {
    return { error: '電子郵件格式錯誤' };
  }

  if ([...reason].length > MAX_REASON_LENGTH) {
    return { error: `備註長度不可超過 ${MAX_REASON_LENGTH} 個字` };
  }

  const lengthError = validateFieldLengths('borrow_requests', {
    classroom_id,
    event_name,
    borrower_department,
    borrower_name,
    borrower_phone,
    borrower_email,
  });
  if (lengthError) return { error: lengthError };

  return {
    booking: {
      classroom_id,
      borrow_type,
      repeat_frequency,
      start_date: start.format('YYYY-MM-DD'),
      end_date,
      start_time,
      end_time,
      event_name,
      people_count,
      reason: reason || null,
      borrower_department,
      borrower_name,
      borrower_phone,
      borrower_email,
    },
  };
}

const INSERT_ADMIN_BOOKING_SQL = `
  INSERT INTO borrow_requests (
    public_id, user_id, classroom_id, borrow_type, repeat_frequency,
    start_date, end_date, start_time, end_time, event_name, people_count,
    reason, status, reject_reason,
    borrower_department, borrower_phone, borrower_email, borrower_name
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?,
    ?, '核准', NULL,
    ?, ?, ?, ?
  )`;

// 管理員依紙本/列印的租借表登錄借用：直接核准，不走指導老師簽核、不寄信。
// 一次可登錄多筆（租借表每個場地一頁），全部成功才寫入，任一筆衝突即整批取消。
exports.createBookings = async (req, res) => {
  const user_id = req.user && req.user.user_id;
  if (!user_id) {
    return res.status(401).json({ error: '無法辨識登入的管理員' });
  }

  const items = req.body && req.body.bookings;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: '請至少提供一筆借用資料' });
  }
  if (items.length > MAX_ADMIN_BOOKINGS) {
    return res
      .status(400)
      .json({ error: `一次最多新增 ${MAX_ADMIN_BOOKINGS} 筆借用` });
  }

  const bookings = [];
  for (let i = 0; i < items.length; i++) {
    const result = normalizeAdminBooking(items[i]);
    if (result.error) {
      return res
        .status(400)
        .json({ error: `第 ${i + 1} 筆：${result.error}`, index: i });
    }
    bookings.push(result.booking);
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const created = [];
    for (let i = 0; i < bookings.length; i++) {
      const booking = bookings[i];
      const occurrenceDates = expandOccurrences(booking);

      const conflict = await findBookingConflict(
        connection,
        booking,
        occurrenceDates
      );
      if (conflict) {
        await connection.rollback();
        const what =
          conflict.type === 'schedule'
            ? '與固定課表衝突'
            : '已被其他申請單預約或正在審核中';
        return res.status(409).json({
          error: `第 ${i + 1} 筆（${booking.classroom_id}）${what}（衝突日期：${conflict.date}），整批未新增。`,
          index: i,
          conflict_type: conflict.type,
          conflict_date: conflict.date,
        });
      }

      const publicId = crypto.randomUUID();
      const [result] = await connection.query(INSERT_ADMIN_BOOKING_SQL, [
        publicId,
        user_id,
        booking.classroom_id,
        booking.borrow_type,
        booking.repeat_frequency,
        booking.start_date,
        booking.end_date,
        booking.start_time,
        booking.end_time,
        booking.event_name,
        booking.people_count,
        booking.reason,
        booking.borrower_department,
        booking.borrower_phone,
        booking.borrower_email,
        booking.borrower_name,
      ]);

      created.push({
        request_id: result.insertId,
        public_id: publicId,
        classroom_id: booking.classroom_id,
        start_date: booking.start_date,
      });
    }

    await connection.commit();

    res.status(201).json({
      message: `已新增 ${created.length} 筆借用`,
      bookings: created,
    });
  } catch (err) {
    await connection.rollback();
    console.error('createBookings error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  } finally {
    connection.release();
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

exports.getAllUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        u.user_id, u.name, u.email, u.phone_number, u.role, u.department, u.created_at,
        b.blacklist_id, b.reason as blacklist_reason, b.expired_at as blacklist_expired_at
      FROM users u
      LEFT JOIN blacklist b ON u.user_id = b.user_id AND (b.expired_at IS NULL OR b.expired_at > NOW())
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.updateUserRole = async (req, res) => {
  const { role } = req.body;
  const user_id = req.params.id;

  if (role === undefined || role === null) {
    return res.status(400).json({ error: 'Missing role field' });
  }

  try {
    const [users] = await pool.query('SELECT * FROM users WHERE user_id = ?', [
      user_id,
    ]);
    if (users.length === 0) {
      return res.status(404).json({ error: '找不到該使用者' });
    }

    const updateSql = 'UPDATE users SET role = ? WHERE user_id = ?';
    await pool.query(updateSql, [role, user_id]);

    res.json({ message: '使用者權限已更新', user_id, role });
  } catch (err) {
    console.error('updateUserRole error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};
