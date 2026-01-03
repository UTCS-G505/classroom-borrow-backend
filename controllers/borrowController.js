const pool = require('../config/db');
const transporter = require('../config/mailer');

// 1. 提交申請
exports.createBorrowRequest = async (req, res) => {
    const { userEmail, teacherEmail, classroom, date, time, activityName } = req.body;

    if (!userEmail || !teacherEmail || !classroom) {
        return res.status(400).json({ success: false, message: '資料不完整' });
    }

    try {
        const [users] = await pool.execute(
            'SELECT user_id, department, name FROM users WHERE email = ?',
            [userEmail]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: '找不到此 Email 的使用者，請先註冊' });
        }
        const user = users[0];

        const timeParts = time.split(' - ');
        const startTime = timeParts[0] || time;
        const endTime = timeParts[1] || '00:00:00';

        const [result] = await pool.execute(
            `INSERT INTO borrow_requests 
        (borrower_id, classroom_id, borrow_type, start_date, start_time, end_time, 
         event_name, status, teacher_email, borrower_email, borrower_department) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                user.user_id, classroom, '單次借用', date, startTime, endTime,
                activityName, '審核中', teacherEmail, userEmail, user.department
            ]
        );

        const borrowId = result.insertId;
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const signOffLink = `${baseUrl}/teacher-signoff?id=${borrowId}`;

        // 寄信給老師
        const mailToTeacher = transporter.sendMail({
            from: process.env.MAIL_USER,
            to: teacherEmail,
            subject: `【請簽核】學生 ${user.name} 申請借用教室`,
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
          <h2 style="color: #E67E22;">教室借用簽核通知</h2>
          <p>老師您好，您的學生申請借用教室，詳細資訊如下：</p>
          <hr>
          <ul>
            <li><strong>申請人：</strong> ${user.name} (${userEmail})</li>
            <li><strong>系級：</strong> ${user.department}</li>
            <li><strong>活動名稱：</strong> ${activityName}</li>
            <li><strong>借用教室：</strong> ${classroom}</li>
            <li><strong>借用時間：</strong> ${date} ${time}</li>
          </ul>
          <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; text-align: center;">
            <p>請點擊下方連結進行「核准」或「退回」：</p>
            <a href="${signOffLink}" style="display: inline-block; padding: 12px 24px; background-color: #4A90E2; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">前往簽核系統</a>
          </div>
        </div>
      `
        });

        // 寄信給學生
        const mailToStudent = transporter.sendMail({
            from: process.env.MAIL_USER,
            to: userEmail,
            subject: `【申請已送出】教室借用申請單 #${borrowId}`,
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
          <h2 style="color: #4A90E2;">申請已成功送出</h2>
          <p>同學您好，您的教室借用申請 (<strong>#${borrowId}</strong>) 已收到。</p>
          <p>系統已自動發信通知您的指導老師進行簽核。</p>
          <hr>
          <p><strong>目前狀態：</strong> <span style="color: orange;">等待老師簽核中</span></p>
        </div>
      `
        });

        await Promise.all([mailToTeacher, mailToStudent]);
        res.json({ success: true, message: '申請已送出' });
    } catch (error) {
        console.error('SQL Error:', error);
        res.status(500).json({ success: false, message: '系統錯誤', error: error.message });
    }
};

// 2. 取得單一申請資料
exports.getBorrowRequest = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM borrow_requests WHERE request_id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: '無此資料' });
        res.json({ success: true, data: rows[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// 3. 老師簽核
exports.teacherSignoff = async (req, res) => {
    const { id, status, comment } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM borrow_requests WHERE request_id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: '無此申請單' });
        const request = rows[0];

        const newStatus = status === 'APPROVED' ? '老師已核准' : '退件';

        await pool.execute(
            'UPDATE borrow_requests SET status = ?, reject_reason = ? WHERE request_id = ?',
            [newStatus, comment || null, id]
        );

        if (newStatus === '老師已核准') {
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            const taSignOffLink = `${baseUrl}/ta-signoff?id=${id}`;
            const taEmail = process.env.TA_EMAIL || 'yangyc1126@gmail.com';

            await transporter.sendMail({
                from: process.env.MAIL_USER,
                to: taEmail,
                subject: `【需助教覆核】申請單 #${id} 指導老師已核准`,
                html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
            <h2 style="color: #2ECC71;">指導老師已核准！</h2>
            <p><strong>申請單號：</strong> #${id}</p>
            <p><strong>申請人Email：</strong> ${request.borrower_email}</p>
            <p><strong>活動名稱：</strong> ${request.event_name}</p>
            <p><strong>老師簽核意見：</strong> ${comment || '無'}</p>
            <hr/>
            <p>請助教點擊下方按鈕，進行最終場地確認與簽核：</p>
            <div style="margin-top: 20px; padding: 15px; background-color: #f9f9f9; text-align: center;">
              <a href="${taSignOffLink}" style="display: inline-block; padding: 12px 24px; background-color: #27AE60; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">前往助教簽核系統</a>
            </div>
          </div>
        `
            });
        } else {
            await transporter.sendMail({
                from: process.env.MAIL_USER,
                to: request.borrower_email,
                subject: `【申請退回】申請單 #${id} 指導老師未核准`,
                html: `<p>您的申請已被指導老師退回。</p><p><strong>理由：</strong>${comment}</p>`
            });
        }
        res.json({ success: true, message: '簽核完成' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 4. 助教簽核
exports.taSignoff = async (req, res) => {
    const { id, status, comment } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM borrow_requests WHERE request_id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: '無此申請單' });
        const request = rows[0];

        const finalStatus = status === 'APPROVED' ? '核准' : '退件';

        await pool.execute(
            'UPDATE borrow_requests SET status = ?, reject_reason = ? WHERE request_id = ?',
            [finalStatus, comment || null, id]
        );

        if (finalStatus === '核准') {
            await transporter.sendMail({
                from: process.env.MAIL_USER,
                to: request.borrower_email,
                subject: `【申請通過】申請單 #${id} 教室借用成功`,
                html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
            <h2 style="color:green">恭喜！您的教室借用申請已通過。</h2>
            <p><strong>單號：</strong> ${id}</p>
            <p><strong>活動名稱：</strong> ${request.event_name}</p>
            <p><strong>助教備註：</strong> ${comment || '無'}</p>
            <hr/>
            <p style="background-color: #e8f5e9; padding: 10px; border-radius: 5px;">✅ <strong>借用狀態：已核准</strong></p>
            <p>請記得準時使用教室，並於使用完畢後將場地復原。</p>
          </div>
        `
            });
        } else {
            await transporter.sendMail({
                from: process.env.MAIL_USER,
                to: request.borrower_email,
                subject: `【申請退回】申請單 #${id} 助教覆核未通過`,
                html: `<p>很抱歉，您的申請在助教覆核階段未通過。</p><p><strong>理由：</strong>${comment}</p>`
            });
        }
        res.json({ success: true, message: '助教簽核完成' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};