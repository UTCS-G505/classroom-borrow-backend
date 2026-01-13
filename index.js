require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');
const app = express();
const port = 3000;

app.use(express.json());

// 手動開啟 CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// 資料庫連線
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Gmail 設定
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// =======================
// 📅 時間處理小工具
// =======================
const formatTimeForDB = (timeStr) => {
  if (!timeStr) return '00:00';
  const t = timeStr.trim();
  if (t.length === 4 && !t.includes(':')) {
    return `${t.substring(0, 2)}:${t.substring(2)}`;
  }
  return t;
};

const formatDateForDisplay = (dateObj) => {
  if (!dateObj) return '';
  const d = new Date(dateObj);
  return d.toISOString().split('T')[0];
};

const formatTimeForDisplay = (timeStr) => {
  if (!timeStr) return '';
  return timeStr.toString().substring(0, 5);
};
// =======================

app.get('/', (req, res) => res.send('Backend Connected!'));

// =========================================================
// API 1: 提交申請
// =========================================================
app.post('/api/borrow', async (req, res) => {
  console.log('📝 收到前端:', req.body);

  const userEmail = req.body.userEmail || req.body.borrowerEmail;
  const teacherEmail = req.body.teacherEmail;
  const classroom = req.body.classroom || req.body.classroomId;
  const activityName = req.body.activityName || req.body.eventName || '教室借用';
  const date = req.body.date;
  const rawTime = req.body.time || '';

  if (!userEmail || !teacherEmail || !classroom) {
    return res.status(400).json({ success: false, message: '資料不完整' });
  }

  try {
    let startTime = '00:00';
    let endTime = '00:00';
    if (rawTime.includes('-')) {
      const parts = rawTime.split('-');
      startTime = formatTimeForDB(parts[0]);
      endTime = formatTimeForDB(parts[1]);
    }

    const sql = `
      INSERT INTO borrow_requests 
      (borrower_id, classroom_id, borrow_type, start_date, start_time, end_time, event_name, status, teacher_email, borrower_email) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `;
    
    const values = [0, classroom, '一般借用', date, startTime, endTime, activityName, teacherEmail, userEmail];
    const [result] = await pool.execute(sql, values);
    const borrowId = result.insertId;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // 寄信給老師
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: teacherEmail,
      subject: `【請簽核】申請單 #${borrowId}`,
      html: `
        <p><strong>申請人：</strong> ${userEmail}</p>
        <p><strong>活動：</strong> ${activityName}</p>
        <p><strong>教室：</strong> ${classroom}</p>
        <p><strong>時間：</strong> ${date} ${startTime} - ${endTime}</p>
        <a href="${baseUrl}/teacher-signoff?id=${borrowId}">前往簽核</a>
      `
    });

    res.json({ success: true, message: '申請已送出' });

  } catch (error) {
    console.error('🔥 SQL 錯誤:', error);
    res.status(500).json({ success: false, message: '系統錯誤: ' + error.message });
  }
});

// =========================================================
// API 2: 取得單筆資料
// =========================================================
app.get('/api/borrow/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM borrow_requests WHERE request_id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '找不到資料' });
    }
    
    const r = rows[0];
    
    const data = {
      id: r.request_id,
      status: r.status,
      activity_name: r.event_name,
      user_email: r.borrower_email,
      applicant_name: r.borrower_email,
      teacher_email: r.teacher_email,
      classroom: r.classroom_id,
      borrow_date: formatDateForDisplay(r.start_date),
      start_time: formatTimeForDisplay(r.start_time),
      end_time: formatTimeForDisplay(r.end_time)
    };

    res.json({ success: true, data: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================================================
// API 3: 老師簽核
// =========================================================
app.post('/api/signoff', async (req, res) => {
  const { id, status, comment } = req.body;
  try {
    const newStatus = status === 'APPROVED' ? 'TEACHER_APPROVED' : 'REJECTED';
    
    await pool.execute('UPDATE borrow_requests SET status = ?, reject_reason = ? WHERE request_id = ?', 
      [newStatus, comment || '', id]
    );

    if (newStatus === 'TEACHER_APPROVED') {
      const taEmail = process.env.TA_EMAIL || 'yangyc1126@gmail.com';
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      
      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: taEmail,
        subject: `【需助教覆核】申請單 #${id}`,
        html: `<p>老師已核准。</p><a href="${baseUrl}/ta-signoff?id=${id}">前往助教簽核</a>`
      });
    }
    res.json({ success: true, message: '簽核完成' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =========================================================
// API 4: 助教簽核 (新增：通知申請人)
// =========================================================
app.post('/api/ta-signoff', async (req, res) => {
  const { id, status } = req.body;
  try {
    // 1. 先抓取申請單資料，才知道要寄給誰
    const [rows] = await pool.execute('SELECT * FROM borrow_requests WHERE request_id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: '找不到申請單' });
    const request = rows[0];

    // 2. 更新狀態
    const finalStatus = status === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    await pool.execute('UPDATE borrow_requests SET status = ? WHERE request_id = ?', [finalStatus, id]);

    // 3. 🔥 新增：寄信通知申請人 (如果核准的話)
    if (finalStatus === 'APPROVED') {
      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to: request.borrower_email, // 寄給申請人 (資料庫欄位是 borrower_email)
        subject: `【申請通過】教室借用申請單 #${id} 已核准`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
            <h2 style="color:green">🎉 恭喜！您的教室借用申請已通過。</h2>
            <p><strong>申請單號：</strong> #${id}</p>
            <p><strong>活動名稱：</strong> ${request.event_name}</p>
            <p><strong>借用教室：</strong> ${request.classroom_id}</p>
            <p><strong>借用日期：</strong> ${formatDateForDisplay(request.start_date)}</p>
            <p><strong>借用時間：</strong> ${formatTimeForDisplay(request.start_time)} - ${formatTimeForDisplay(request.end_time)}</p>
            <hr/>
            <p style="background-color: #e8f5e9; padding: 10px; border-radius: 5px;">
               ✅ <strong>最終狀態：助教已核准 (APPROVED)</strong>
            </p>
            <p>請記得準時使用教室，並於使用完畢後將場地復原。</p>
          </div>
        `
      });
      console.log(`已發送核准信給申請人: ${request.borrower_email}`);
    }

    res.json({ success: true, message: '助教簽核完成' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});