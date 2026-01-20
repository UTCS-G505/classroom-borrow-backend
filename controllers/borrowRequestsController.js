const pool = require('../db');
const dayjs = require('dayjs');
const emailService = require('../services/emailService');

exports.getBookings = async (req, res) => {
  try {
    const id = req.query.id;
    const sql =
      'SELECT * FROM borrow_requests WHERE borrower_id = ? ORDER BY created_at DESC';
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
    const sql = 'SELECT * FROM borrow_requests WHERE request_id = ?';
    const [rows] = await pool.query(sql, [value]);
    res.json(rows);
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: '資料庫錯誤' });
  }
};

exports.postBookings = async (req, res) => {
  var {
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
    borrower_email,
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
      error: `缺少必要欄位: ${missing.join(', ')}`,
    });
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

  // 2. SQL 邏輯：檢查時段重疊
  const checkSql = `
        SELECT *
        FROM schedule
        WHERE classroom_id = ?
          AND date BETWEEN ? AND ?
          AND SUBSTRING_INDEX(time_slot, '-', 1) < ?
          AND SUBSTRING_INDEX(time_slot, '-', -1) > ?
        FOR UPDATE
    `;

  const chkvalues = [classroom_id, sDate, eDate, end_time, start_time];

  // SQL INSERT
  const insertSql = `
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
        ? , ? , ? )`;

  // 取得資料庫連線以啟動交易
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 檢查時段衝突
    const [rows] = await connection.query(checkSql, chkvalues);

    if (rows.length > 0) {
      console.log(
        `時段衝突！輸入的 ${start_time}~${end_time} 與現有的 ${rows[0].time_slot} 重疊`
      );
      await connection.rollback();
      return res.status(409).json({ error: '該時段已滿，與現有行程衝突' });
    }

    console.log('檢查通過，時段可用');

    if (!teacher_department) teacher_department = '';
    if (!teacher_phone) teacher_phone = '';
    if (!teacher_email) teacher_email = '';
    if (!borrower_department) borrower_department = '';
    if (!borrower_phone) borrower_phone = '';
    if (!borrower_email) borrower_email = '';

    const values = [
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
      await emailService.sendTeacherSignoffMail({
        teacherEmail: teacher_email,
        borrowId: result.insertId,
        userEmail: borrower_email,
        activityName: event_name,
        classroom: classroom_id,
        date: sDate,
        startTime: start_time,
        endTime: end_time,
        baseUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
      });
    }

    res.json({ message: '申請已建立', request_id: result.insertId });
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

  try {
    const newStatus = status === '核准' ? '教師核准' : '退件';

    await pool.execute(
      'UPDATE borrow_requests SET status = ?, reject_reason = ? WHERE request_id = ?',
      [newStatus, comment || '', id]
    );

    if (newStatus === '教師核准') {
      const taEmail = process.env.TA_EMAIL || 'yangyc1126@gmail.com';
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      await emailService.sendTASignoffMail({
        taEmail,
        borrowId: id,
        baseUrl,
      });
    }
    res.json({ success: true, message: '簽核完成' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.taSignoff = async (req, res) => {
  const { id, status } = req.body;
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM borrow_requests WHERE request_id = ?',
      [id]
    );
    if (rows.length === 0)
      return res.status(404).json({ success: false, message: '找不到申請單' });
    const request = rows[0];

    await pool.execute(
      'UPDATE borrow_requests SET status = ? WHERE request_id = ?',
      [status, id]
    );

    if (status === '核准') {
      await emailService.sendApprovalNotification({
        userEmail: request.borrower_email,
        borrowId: id,
        eventName: request.event_name,
        classroom: request.classroom_id,
        startDate: request.start_date,
        startTime: request.start_time, // Note: DB format might be needed
        endTime: request.end_time,
      });
    }

    res.json({ success: true, message: '助教簽核完成' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
};
