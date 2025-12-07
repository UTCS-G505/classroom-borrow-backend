require('dotenv').config(); // 1. 載入環境變數
const express = require('express');
const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise'); // 引入資料庫套件
const app = express();
const port = 3000;

app.use(express.json());

// ---------------------------------------------------------
// 1. 設定資料庫連線池
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// 2. 設定 Gmail 發送器
// ---------------------------------------------------------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// ---------------------------------------------------------
// 3. 測試路由
// ---------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({status: 'ok'});
});

app.get('/', (req, res) => {
  res.send('Classroom Borrow Backend is Running!');
});

// ---------------------------------------------------------
// 4. API: 提交申請 (寫入 DB -> 寄信給老師 & 學生)
// ---------------------------------------------------------
app.post('/api/borrow', async (req, res) => {
  const { userEmail, teacherEmail, classroom, date, time, activityName } = req.body;
  console.log('收到申請:', req.body);

  if (!userEmail || !teacherEmail || !classroom) {
    return res.status(400).json({ success: false, message: '資料不完整' });
  }

  try {
    // A. 解析時間字串 (前端傳來的是 "0810-0900 - 1010-1100")
    const timeParts = time.split(' - '); 
    const startTime = timeParts[0] || time;
    const endTime = timeParts[1] || '';

    // B. 寫入資料庫
    const [result] = await pool.execute(
      `INSERT INTO borrow_requests 
      (user_email, teacher_email, classroom, borrow_date, start_time, end_time, activity_name) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userEmail, teacherEmail, classroom, date, startTime, endTime, activityName]
    );

    const borrowId = result.insertId; // 取得產生的申請單 ID
    console.log(`資料已寫入 DB，ID: ${borrowId}`);

    // 3. 產生簽核連結 (讀取 .env 設定)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const signOffLink = `${baseUrl}/teacher-signoff?id=${borrowId}`;

    // D. 寄信給指導老師 (附上連結)
    const mailToTeacher = {
      from: process.env.MAIL_USER,
      to: teacherEmail,
      subject: `【請簽核】學生 ${userEmail} 申請借用教室`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
          <h2 style="color: #E67E22;">教室借用簽核通知</h2>
          <p>老師您好，您的學生申請借用教室，詳細資訊如下：</p>
          <hr>
          <ul>
            <li><strong>申請人：</strong> ${userEmail}</li>
            <li><strong>活動名稱：</strong> ${activityName}</li>
            <li><strong>借用教室：</strong> ${classroom}</li>
            <li><strong>借用時間：</strong> ${date} ${time}</li>
          </ul>
          <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; text-align: center;">
            <p>請點擊下方連結進行「核准」或「退回」：</p>
            <a href="${signOffLink}" style="display: inline-block; padding: 12px 24px; background-color: #4A90E2; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
              前往簽核系統
            </a>
            <p style="margin-top:10px; font-size: 12px; color: gray;">或複製連結：${signOffLink}</p>
          </div>
        </div>
      `
    };

    // E. 寄信給學生 (通知已送出)
    const mailToStudent = {
      from: process.env.MAIL_USER,
      to: userEmail,
      subject: '【申請已送出】等待老師簽核中',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
          <h2 style="color: #4A90E2;">申請已送出</h2>
          <p>同學您好，您的申請單 <b>#${borrowId}</b> 已送出，系統已通知指導老師進行簽核。</p>
          <p>待老師核准後，您將會收到最終確認信。</p>
        </div>
      `
    };

    // 同時寄送兩封信
    await Promise.all([transporter.sendMail(mailToTeacher), transporter.sendMail(mailToStudent)]);
    
    res.json({ success: true, message: '申請已送出，等待老師簽核！' });

  } catch (error) {
    console.error('處理失敗:', error);
    res.status(500).json({ success: false, message: '系統錯誤', error: error.message });
  }
});

// ---------------------------------------------------------
// 5. API: 取得單筆詳細資料 (給前端簽核頁面用)
// ---------------------------------------------------------
app.get('/api/borrow/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM borrow_requests WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: '找不到此申請' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------
// 6. API: 老師執行簽核 (更新狀態 -> 根據結果寄信)
// ---------------------------------------------------------
app.post('/api/signoff', async (req, res) => {
  const { id, status, comment } = req.body; 
  console.log(`收到簽核請求 ID: ${id}, Status: ${status}`);

  try {
    // A. 檢查申請是否存在，並撈取資料 (為了寄信給學生)
    const [rows] = await pool.execute('SELECT * FROM borrow_requests WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: '無此申請單' });
    const request = rows[0];

    // B. 更新資料庫狀態
    await pool.execute('UPDATE borrow_requests SET status = ? WHERE id = ?', [status, id]);

    // C. 根據狀態寄信
    if (status === 'APPROVED') {
      // --- 核准：寄信給助教 (TA) ---
      const mailToAdmin = {
        from: process.env.MAIL_USER,
        // 優先讀取 .env 的 TA_EMAIL，如果沒設定就寄給 yangyc1126
        to: process.env.TA_EMAIL || 'yangyc1126@gmail.com', 
        subject: `【簽核成功】申請單 #${id} 進入助教簽核流程`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
            <h2 style="color: green;">老師已核准！</h2>
            <p>申請單號：<b>#${id}</b></p>
            <p>申請人：${request.user_email}</p>
            <p>活動：${request.activity_name}</p>
            <p>老師簽核意見：${comment || '無'}</p>
            <hr/>
            <p>請助教進行最終場地確認。</p>
          </div>
        `
      };
      await transporter.sendMail(mailToAdmin);
      console.log('已寄信通知助教');

    } else if (status === 'REJECTED') {
      // --- 退回：寄信給申請學生 ---
      const mailToStudent = {
        from: process.env.MAIL_USER,
        to: request.user_email, // 從資料庫撈出的學生信箱
        subject: `【申請退回】您的申請單 #${id} 未通過簽核`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
            <h2 style="color: #E74C3C;">申請已被退回</h2>
            <p>同學您好，您的教室借用申請（單號 #${id}）已被指導老師退回。</p>
            <hr>
            <p><strong>退回原因 / 老師意見：</strong></p>
            <p style="background-color: #f9f9f9; padding: 10px; border-left: 4px solid #E74C3C;">
              ${comment || '（老師未填寫原因）'}
            </p>
            <hr>
            <p>請修正後重新申請，或與指導老師聯繫。</p>
          </div>
        `
      };
      await transporter.sendMail(mailToStudent);
      console.log('已寄信通知學生 (退回)');
    }

    res.json({ success: true, message: `已完成簽核：${status}` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});