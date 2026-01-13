const pool = require('../config/db'); // 請確認路徑是否正確
const transporter = require('../config/mailer'); // 請確認路徑是否正確

// =========================================================
// 1. 建立借用申請 (修正版：不查 users 表，直接存 Email)
// =========================================================
exports.createBorrowRequest = async (req, res) => {
  // 1. 接收前端各種可能的欄位名稱
  const userEmail = req.body.userEmail || req.body.borrowerEmail;
  const teacherEmail = req.body.teacherEmail;
  const classroom = req.body.classroom || req.body.classroomId;
  const activityName = req.body.activityName || req.body.eventName;
  const date = req.body.date || req.body.startDate;
  const time = req.body.time || '';

  // 2. 檢查必填
  if (!userEmail || !teacherEmail || !classroom) {
    return res.status(400).json({ success: false, message: '資料不完整' });
  }

  try {
    // 3. 處理時間字串 (例如 "1310 - 1500")
    let startTime = time;
    let endTime = '';
    if (time.includes('-')) {
      // 處理有些前端傳來可能包含空白的情況
      const parts = time.split('-').map(t => t.trim());
      startTime = parts[0] || '';
      endTime = parts[1] || '';
    } else if (time.includes(' ')) {
      const parts = time.split(' ').map(t => t.trim());
      startTime = parts[0] || '';
      endTime = parts[parts.length - 1] || ''; // 取最後一個當結束
    }

    console.log('正在寫入資料庫:', { userEmail, classroom, date, startTime, endTime });

    // 4. 執行 SQL (直接寫入 borrow_requests，不使用 borrower_id)
    // ⚠️ 注意：這裡假設你的資料庫欄位是 user_email, teacher_email...
    const [result] = await pool.execute(
      `INSERT INTO borrow_requests 
       (user_email, teacher_email, classroom, borrow_date, start_time, end_time, activity_name, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [userEmail, teacherEmail, classroom, date, startTime, endTime, activityName]
    );

    const borrowId = result.insertId;
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // 5. 寄信
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: teacherEmail,
      subject: `【請簽核】申請單 #${borrowId}`,
      html: `
        <h3>教室借用申請</h3>
        <p>申請人：${userEmail}</p>
        <p>活動：${activityName}</p>
        <p>時間：${date} ${startTime} - ${endTime}</p>
        <p>教室：${classroom}</p>
        <hr/>
        <a href="${baseUrl}/teacher-signoff?id=${borrowId}">前往簽核</a>
      `
    });

    res.json({ success: true, message: '申請已送出' });

  } catch (err) {
    // 🔥 重要：把錯誤印出來，這樣我們才看得到 System Error 到底是什麼
    console.error('SQL 錯誤詳細資訊:', err);
    res.status(500).json({ success: false, message: '系統錯誤', error: err.message });
  }
};

// =========================================================
// 2. 取得單筆申請 (修正版：不 JOIN users 表)
// =========================================================
exports.getBorrowRequest = async (req, res) => {
  try {
    const id = req.query.id || req.params.id;

    if (!id) {
      return res.status(400).json({ message: '缺少申請單 ID' });
    }

    console.log(`正在查詢申請單 ID: ${id}`);

    // ⚠️ 修正：直接查 borrow_requests，不 JOIN users
    const [rows] = await pool.execute(
      `SELECT * FROM borrow_requests WHERE id = ?`, 
      [id]
    );

    // 如果上面那行報錯 Unknown column 'id'，請改用 request_id
    // const [rows] = await pool.execute('SELECT * FROM borrow_requests WHERE request_id = ?', [id]);

    if (rows.length === 0) {
      console.log(`找不到申請單 ID: ${id}`);
      return res.status(404).json({ message: '找不到資料' });
    }

    const r = rows[0];

    // 整理回傳格式
    const response = {
      // ID (相容 id 或 request_id)
      request_id: r.id || r.request_id,
      status: r.status,

      // 活動
      activityName: r.activity_name || r.event_name,
      
      // 申請人 (沒有 name 欄位就顯示 email)
      userEmail: r.user_email || r.borrower_email,
      applicantName: r.user_email || r.borrower_email, // 暫用 Email 代替名字

      // 教室
      classroom: r.classroom || r.classroom_id,

      // 時間
      borrow_date: r.borrow_date || r.start_date,
      start_time: r.start_time,
      end_time: r.end_time,
      
      // 老師
      teacherEmail: r.teacher_email,
    };

    console.log('[GET BorrowRequest]', response);
    res.json({ success: true, data: response }); // 前端通常預期外面包一層 data 或是直接回傳

  } catch (err) {
    console.error('查詢申請單錯誤:', err);
    res.status(500).json({ message: '系統錯誤' });
  }
};

// =========================================================
// 3. 老師簽核 (修正版：兼容 id 欄位名)
// =========================================================
exports.teacherSignoff = async (req, res) => {
  const { id, status, comment } = req.body;
  if (!id) return res.status(400).json({ message: '缺少 ID' });

  try {
    const newStatus = status === 'APPROVED' ? 'TEACHER_APPROVED' : 'REJECTED'; // 注意這裡狀態名稱要跟前端對上

    // 嘗試更新
    // 假設你的主鍵是 id
    let sql = 'UPDATE borrow_requests SET status = ? WHERE id = ?';
    // 如果你的主鍵是 request_id，請自行修改下一行為:
    // let sql = 'UPDATE borrow_requests SET status = ? WHERE request_id = ?';

    await pool.execute(sql, [newStatus, id]);

    res.json({ success: true, message: '簽核完成' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '系統錯誤' });
  }
};

// =========================================================
// 4. 助教簽核 (同上)
// =========================================================
exports.taSignoff = async (req, res) => {
  const { id, status, comment } = req.body;
  try {
    const finalStatus = status === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    
    // 假設主鍵是 id
    await pool.execute(
      'UPDATE borrow_requests SET status = ? WHERE id = ?',
      [finalStatus, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '系統錯誤' });
  }
};  