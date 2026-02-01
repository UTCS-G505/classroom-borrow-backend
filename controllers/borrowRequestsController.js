const pool = require('../db');
const dayjs = require('dayjs');
const emailService = require('../services/emailService');
const { USER_ROLES, VALID_CLASSROOMS } = require('../utils/constants');
const crypto = require('crypto');

exports.getBookings = async (req, res) => {
  try {
    const id = req.query.id;
    const sql =
      'SELECT * FROM borrow_requests WHERE user_id = ? ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, [id]);
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.getBookingsById = async (req, res) => {
  try {
    const value = req.params.id;
    const sql = 'SELECT * FROM borrow_requests WHERE public_id = ?';
    const [rows] = await pool.query(sql, [value]);
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.postBookings = async (req, res) => {
  var {
    user_id,
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
    borrower_email,
  } = req.body;

  const missing = [];
  if (!user_id) missing.push('user_id');
  if (!classroom_id) missing.push('classroom_id');
  if (!borrow_type) missing.push('borrow_type');
  if (!start_date) missing.push('start_date');
  if (!start_time) missing.push('start_time');
  if (!event_name) missing.push('event_name');

  if (missing.length > 0) {
    return res.status(400).json({
      error: `缺少必要欄位: ${missing.join(', ')}`,
    });
  }

  // Validate classroom_id
  if (!VALID_CLASSROOMS.includes(classroom_id)) {
    return res.status(400).json({ error: '無效的教室代號' });
  }

  if (end_time && end_time <= start_time) {
    return res.status(400).json({ error: '結束時間必須晚於開始時間' });
  }

  if (people_count && people_count < 0) {
    return res.status(400).json({ error: '人數不可為負數' });
  }

  // 1. 準備日期與輸入時間
  let sDate = dayjs(start_date).format('YYYY-MM-DD');
  let eDate = dayjs(!end_date ? start_date : end_date).format('YYYY-MM-DD');

  // 2. SQL 邏輯：檢查 borrow_requests (申請中或已核准案件) 重疊
  // 檢查同一間教室、同一天，且狀態不是「退件/已取消/已歸還」的申請單
  // 這些狀態包含：'審核中', '教師核准', '核准', '已預約'
  const checkRequestsSql = `
        SELECT request_id 
        FROM borrow_requests 
        WHERE classroom_id = ? 
          AND start_date = ? 
          AND status NOT IN ('退件', '已取消', '已歸還')
          AND start_time < ? 
          AND end_time > ?
        FOR UPDATE
    `;

  const reqValues = [classroom_id, sDate, end_time, start_time];

  // SQL INSERT
  const insertSql = `
        INSERT INTO borrow_requests (
        public_id, user_id, classroom_id, borrow_type, start_date, end_date,
        start_time, end_time, event_name, people_count, 
        teacher_name, reason, status, reject_reason,
        teacher_department, teacher_phone, teacher_email,
        borrower_department, borrower_phone, borrower_email
        ) VALUES (
        ?, ? , ? , ? , ? , ? , 
        ? , ? , ? , ? ,
        ? , ? , ? , ? ,
        ? , ? , ? ,
        ? , ? , ? )`;

  // 取得資料庫連線以啟動交易
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 檢查 borrow_requests 衝突 (包含已預約和申請中的)
    const [reqRows] = await connection.query(checkRequestsSql, reqValues);

    if (reqRows.length > 0) {
      console.log(`時段衝突！該時段已被預約或正在審核中`);
      await connection.rollback();
      return res.status(409).json({
        error: '該時段已被其他申請單預約或正在審核中，請選擇其他時間。',
      });
    }

    console.log('檢查通過，時段可用');

    if (!teacher_department) teacher_department = '';
    if (!teacher_phone) teacher_phone = '';
    if (!teacher_email) teacher_email = '';
    if (!borrower_department) borrower_department = '';
    if (!borrower_phone) borrower_phone = '';
    if (!borrower_email) borrower_email = '';

    const publicId = crypto.randomUUID();

    const values = [
      publicId,
      user_id,
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
      '審核中',
      teacher_department,
      teacher_phone,
      teacher_email,
      borrower_department,
      borrower_phone,
      borrower_email,
    ];

    const [result] = await connection.query(insertSql, values);
    await connection.commit();

    // 寄信給老師
    if (teacher_email) {
      // 使用 try-catch 包裹寄信，避免因寄信失敗導致 API 回傳錯誤
      try {
        await emailService.sendTeacherSignoffMail({
          teacherEmail: teacher_email,
          borrowId: result.insertId,
          publicId: publicId, // Pass public ID
          userEmail: borrower_email,
          activityName: event_name,
          classroom: classroom_id,
          date: sDate,
          startTime: start_time,
          endTime: end_time,
          baseUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
        });
      } catch (emailError) {
        console.error('Email 寄送失敗:', emailError);
      }
    }

    res.json({
      message: '申請已建立',
      request_id: result.insertId,
      public_id: publicId,
    });
  } catch (err) {
    await connection.rollback();
    console.error('新增資料失敗:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  } finally {
    connection.release();
  }
};

exports.putCancelBookings = async (req, res) => {
  const sql = `
    UPDATE borrow_requests
    SET status = '已取消'
    WHERE request_id = ?;`;

  const value = req.params.id;

  try {
    await pool.query(sql, [value]);
    res.json({ message: '已取消', request_id: value });
  } catch (err) {
    console.error('變更資料失敗:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.putReturnBookings = async (req, res) => {
  const sql = `
    UPDATE borrow_requests
    SET status = '已歸還'
    WHERE request_id = ?;`;

  const value = req.params.id;

  try {
    await pool.query(sql, [value]);
    res.json({ message: '已歸還', request_id: value });
  } catch (err) {
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.teacherSignoff = async (req, res) => {
  const { id, status, comment } = req.body;

  // Role Validation: Check if user is TEACHER, ADMIN or OFFICER
  const userRole = req.user.role;
  if (
    ![USER_ROLES.TEACHER, USER_ROLES.ADMIN, USER_ROLES.OFFICER].includes(
      userRole
    )
  ) {
    return res
      .status(403)
      .json({ success: false, message: '權限不足：僅限教師或管理員簽核' });
  }

  try {
    // 查詢申請單資料 (用於寄信與確認存在)
    const [rows] = await pool.query(
      'SELECT * FROM borrow_requests WHERE public_id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '找不到申請單' });
    }
    const request = rows[0];

    const newStatus = status === '核准' ? '教師核准' : '退件';

    await pool.execute(
      'UPDATE borrow_requests SET status = ?, reject_reason = ? WHERE public_id = ?',
      [newStatus, comment || '', id]
    );

    if (newStatus === '教師核准') {
      const taEmail = process.env.TA_EMAIL || 'yangyc1126@gmail.com';
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      try {
        await emailService.sendTASignoffMail({
          taEmail,
          borrowId: request.request_id, // 使用內部 Integer ID 顯示
          publicId: request.public_id, // 使用 UUID 於連結
          baseUrl,
        });
      } catch (emailError) {
        console.error('助教通知信寄送失敗:', emailError);
      }
    } else if (newStatus === '退件') {
      // 駁回通知申請人
      try {
        await emailService.sendRejectionNotification({
          userEmail: request.borrower_email,
          borrowId: request.request_id,
          eventName: request.event_name,
          classroom: request.classroom_id,
          startDate: request.start_date,
          startTime: request.start_time,
          endTime: request.end_time,
          reason: comment,
        });
      } catch (emailError) {
        console.error('駁回通知信寄送失敗:', emailError);
      }
    }
    res.json({ success: true, message: '簽核完成' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.taSignoff = async (req, res) => {
  const { id, status, reject_reason } = req.body;

  // Role Validation: Check if user is ADMIN or OFFICER
  const userRole = req.user.role;
  if (![USER_ROLES.ADMIN, USER_ROLES.OFFICER].includes(userRole)) {
    return res
      .status(403)
      .json({ success: false, message: '權限不足：僅限管理員或系辦人員簽核' });
  }

  // 取得資料庫連線以啟動交易 (確保核准過程的原子性)
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT * FROM borrow_requests WHERE public_id = ? FOR UPDATE',
      [id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '找不到申請單' });
    }
    const request = rows[0];

    // 若助教要核准，需再次檢查是否有衝突 (防護機制 3)
    if (status === '核准') {
      // 檢查 borrow_requests 表 (其他剛剛被核准的單子) by internal request_id exclusion
      const checkRequestsSql = `
          SELECT request_id FROM borrow_requests 
          WHERE classroom_id = ? 
          AND start_date = ? 
          AND status IN ('核准', '已預約') 
          AND request_id != ? 
          AND start_time < ? 
          AND end_time > ?
      `;
      const [conflictRequests] = await connection.query(checkRequestsSql, [
        request.classroom_id,
        request.start_date,
        request.request_id, // Use internal ID for exclusion check
        request.end_time,
        request.start_time,
      ]);

      if (conflictRequests.length > 0) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: '衝突警告：該時段剛剛已經被另一張申請單核准了。',
        });
      }
    }

    await connection.query(
      'UPDATE borrow_requests SET status = ?, reject_reason = ? WHERE public_id = ?',
      [status, status === '退件' ? reject_reason : null, id]
    );

    await connection.commit();

    if (status === '核准') {
      try {
        await emailService.sendApprovalNotification({
          userEmail: request.borrower_email,
          borrowId: request.request_id, // Use Internal ID for display
          eventName: request.event_name,
          classroom: request.classroom_id,
          startDate: request.start_date,
          startTime: request.start_time,
          endTime: request.end_time,
        });
      } catch (emailError) {
        console.error('核准通知信寄送失敗:', emailError);
      }
    } else if (status === '退件') {
      try {
        await emailService.sendRejectionNotification({
          userEmail: request.borrower_email,
          borrowId: request.request_id, // Use Internal ID for display
          eventName: request.event_name,
          classroom: request.classroom_id,
          startDate: request.start_date,
          startTime: request.start_time,
          endTime: request.end_time,
          reason: reject_reason,
        });
      } catch (emailError) {
        console.error('駁回通知信寄送失敗:', emailError);
      }
    }

    res.json({ success: true, message: '助教簽核完成' });
  } catch (err) {
    await connection.rollback();
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    connection.release();
  }
};
