const pool = require('../db');
const dayjs = require('dayjs');
const emailService = require('../services/emailService');
const { USER_ROLES, VALID_CLASSROOMS } = require('../utils/constants');
const { validateFieldLengths } = require('../utils/fieldLimits');
const {
  expandOccurrences,
  findOverlappingDate,
  findScheduleConflictDate,
} = require('../utils/occurrences');
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

    if (rows.length === 0) {
      return res.status(404).json({ error: '找不到此申請單' });
    }

    const booking = rows[0];
    const isOwner = req.user.user_id === booking.user_id;
    const isPrivileged = [
      USER_ROLES.ADMIN,
      USER_ROLES.OFFICER,
      USER_ROLES.TEACHER,
    ].includes(req.user.role);

    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ error: '您無權查看此申請單' });
    }

    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.postBookings = async (req, res) => {
  // Force user_id from authenticated user to prevent creating bookings for others
  const user_id = req.user.user_id;
  const {
    classroom_id,
    borrow_type,
    repeat_frequency,
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
    borrower_name,
  } = req.body;

  const missing = [];
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

  // Check if user is blacklisted
  try {
    const [blacklistRows] = await pool.query(
      `SELECT blacklist_id, reason, expired_at 
       FROM blacklist 
       WHERE user_id = ? 
       AND (expired_at IS NULL OR expired_at > NOW())`,
      [user_id]
    );

    if (blacklistRows.length > 0) {
      const entry = blacklistRows[0];
      return res.status(403).json({
        error: '您目前在黑名單中，無法進行借用申請',
        reason: entry.reason,
        expired_at: entry.expired_at,
      });
    }
  } catch (err) {
    console.error('Blacklist check error:', err);
    return res.status(500).json({ error: '資料庫錯誤' });
  }

  // Validate classroom_id
  if (!VALID_CLASSROOMS.includes(classroom_id)) {
    return res.status(400).json({ error: '無效的教室代號' });
  }

  // Validate VARCHAR field lengths to avoid DB "Data too long" errors
  const lengthError = validateFieldLengths('borrow_requests', {
    classroom_id,
    event_name,
    teacher_name,
    teacher_department,
    teacher_phone,
    teacher_email,
    borrower_department,
    borrower_phone,
    borrower_email,
    borrower_name,
  });
  if (lengthError) {
    return res.status(400).json({ error: lengthError });
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

  // 2. 展開這張申請單實際會佔用教室的日期
  //    單次借用 = 起始日一天；多次借用 = 依每天/每周展開整段期間
  const occurrenceDates = expandOccurrences({
    borrow_type,
    repeat_frequency,
    start_date: sDate,
    end_date: eDate,
  });

  // 3. SQL 邏輯：先用「時間段重疊 + 日期區間重疊」粗篩出可能衝突的申請單，
  //    再在 JS 端把雙方展開成實際日期比對，多次借用才不會只比到 start_date。
  //    狀態不是「退件/已取消/已歸還」的都視為佔用（審核中、教師核准、核准）。
  const checkRequestsSql = `
        SELECT request_id, borrow_type, repeat_frequency, start_date, end_date
        FROM borrow_requests 
        WHERE classroom_id = ? 
          AND status NOT IN ('退件', '已取消', '已歸還')
          AND start_time < ? 
          AND end_time > ?
          AND start_date <= ?
          AND COALESCE(end_date, start_date) >= ?
        FOR UPDATE
    `;

  const reqValues = [classroom_id, end_time, start_time, eDate, sDate];

  // SQL INSERT
  const insertSql = `
        INSERT INTO borrow_requests (
        public_id, user_id, classroom_id, borrow_type, repeat_frequency, start_date, end_date,
        start_time, end_time, event_name, people_count, 
        teacher_name, reason, status, reject_reason,
        teacher_department, teacher_phone, teacher_email,
        borrower_department, borrower_phone, borrower_email, borrower_name
        ) VALUES (
        ?, ? , ? , ? , ? , ? , ? ,
        ? , ? , ? , ? ,
        ? , ? , ? , ? ,
        ? , ? , ? ,
        ? , ? , ?, ? )`;

  // 取得資料庫連線以啟動交易
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 檢查 borrow_requests 衝突 (審核中 / 教師核准 / 核准 的單子都算佔用)
    const [reqRows] = await connection.query(checkRequestsSql, reqValues);

    let conflictDate = null;
    for (const row of reqRows) {
      conflictDate = findOverlappingDate(occurrenceDates, row);
      if (conflictDate) break;
    }

    if (conflictDate) {
      console.log(`時段衝突！${conflictDate} 已被預約或正在審核中`);
      await connection.rollback();
      return res.status(409).json({
        error: `該時段已被其他申請單預約或正在審核中（衝突日期：${conflictDate}），請選擇其他時間。`,
        conflict_date: conflictDate,
      });
    }

    // 檢查固定課表衝突 class_schedules
    // 一樣先粗篩（教室、時間段、學期區間），再確認展開後的日期是否落在課程的星期上
    const classCheckSql = `
        SELECT schedule_id, weekday, semester_start_date, semester_end_date
        FROM class_schedules
        WHERE classroom_id = ?
          AND semester_start_date <= ?
          AND semester_end_date >= ?
          AND start_time < ?
          AND end_time > ?
      `;
    const classCheckValues = [classroom_id, eDate, sDate, end_time, start_time];

    const [classReqRows] = await connection.query(
      classCheckSql,
      classCheckValues
    );

    let classConflictDate = null;
    for (const schedule of classReqRows) {
      classConflictDate = findScheduleConflictDate(occurrenceDates, schedule);
      if (classConflictDate) break;
    }

    if (classConflictDate) {
      console.log(`固定課表衝突！${classConflictDate} 該時段已有安排課程`);
      await connection.rollback();
      return res.status(409).json({
        error: `該時段與固定課表衝突（衝突日期：${classConflictDate}），請選擇其他時間。`,
        conflict_date: classConflictDate,
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
      repeat_frequency || null,
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
      borrower_name || '',
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
          endDate: eDate,
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
  const bookingId = req.params.id;

  try {
    // Fetch the booking to verify ownership
    const [rows] = await pool.query(
      'SELECT user_id FROM borrow_requests WHERE request_id = ?',
      [bookingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '找不到此申請單' });
    }

    const booking = rows[0];
    const isOwner = req.user.user_id === booking.user_id;
    const isAdmin = [USER_ROLES.ADMIN, USER_ROLES.OFFICER].includes(
      req.user.role
    );

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: '您無權取消此申請單' });
    }

    await pool.query(
      `UPDATE borrow_requests SET status = '已取消' WHERE request_id = ?;`,
      [bookingId]
    );
    res.json({ message: '已取消', request_id: bookingId });
  } catch (err) {
    console.error('變更資料失敗:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.putReturnBookings = async (req, res) => {
  const bookingId = req.params.id;

  try {
    // Fetch the booking to verify ownership
    const [rows] = await pool.query(
      'SELECT user_id FROM borrow_requests WHERE request_id = ?',
      [bookingId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '找不到此申請單' });
    }

    const booking = rows[0];
    const isOwner = req.user.user_id === booking.user_id;
    const isAdmin = [USER_ROLES.ADMIN, USER_ROLES.OFFICER].includes(
      req.user.role
    );

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: '您無權歸還此申請單' });
    }

    await pool.query(
      `UPDATE borrow_requests SET status = '已歸還' WHERE request_id = ?;`,
      [bookingId]
    );
    res.json({ message: '已歸還', request_id: bookingId });
  } catch (err) {
    console.error('變更資料失敗:', err);
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
          comment,
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
      // 檢查 borrow_requests 表 (其他剛剛被核准的單子)
      // 一樣先粗篩，再用展開後的日期比對，多次借用才不會只比到 start_date
      const requestDates = expandOccurrences(request);
      const checkRequestsSql = `
          SELECT request_id, borrow_type, repeat_frequency, start_date, end_date
          FROM borrow_requests 
          WHERE classroom_id = ? 
          AND status IN ('核准', '已預約') 
          AND request_id != ? 
          AND start_time < ? 
          AND end_time > ?
          AND start_date <= ?
          AND COALESCE(end_date, start_date) >= ?
      `;
      const [conflictRequests] = requestDates.length
        ? await connection.query(checkRequestsSql, [
            request.classroom_id,
            request.request_id, // Use internal ID for exclusion check
            request.end_time,
            request.start_time,
            requestDates[requestDates.length - 1],
            requestDates[0],
          ])
        : [[]];

      let conflictDate = null;
      for (const row of conflictRequests) {
        conflictDate = findOverlappingDate(requestDates, row);
        if (conflictDate) break;
      }

      if (conflictDate) {
        await connection.rollback();
        return res.status(409).json({
          success: false,
          message: `衝突警告：${conflictDate} 該時段剛剛已經被另一張申請單核准了。`,
          conflict_date: conflictDate,
        });
      }
    }

    await connection.query(
      'UPDATE borrow_requests SET status = ?, reject_reason = ? WHERE public_id = ?',
      [status, reject_reason, id]
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
          endDate: request.end_date,
          startTime: request.start_time,
          endTime: request.end_time,
          comment: reject_reason,
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
