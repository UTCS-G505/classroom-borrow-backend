const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const formatDateForDisplay = (dateObj) => {
  if (!dateObj) return '';
  const d = new Date(dateObj);
  return d.toISOString().split('T')[0];
};

const formatTimeForDisplay = (timeStr) => {
  if (!timeStr) return '';
  return timeStr.toString().substring(0, 5);
};

// 樣式設定：保持簡潔現代感
const styles = {
  container: 'font-family: "PingFang TC", "Heiti TC", "Microsoft JhengHei", sans-serif; color: #333; max-width: 600px; border: 1px solid #eee; padding: 24px; border-radius: 12px;',
  title: 'font-size: 20px; font-weight: bold; margin-bottom: 16px;',
  item: 'margin: 8px 0; font-size: 15px;',
  label: 'color: #666; width: 80px; display: inline-block;',
  button: 'display: inline-block; padding: 12px 24px; background-color: #4A90E2; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; margin-top: 20px;',
  noteBox: 'background-color: #f8f9fa; border-left: 4px solid #ddd; padding: 12px; margin: 16px 0; border-radius: 4px;'
};

const sendTeacherSignoffMail = async ({
  teacherEmail,
  borrowId,
  userEmail,
  activityName,
  classroom,
  date,
  startTime,
  endTime,
  baseUrl,
  publicId,
}) => {
  const idToUse = publicId || borrowId;
  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: teacherEmail,
    subject: `【需簽核】教室借用申請：${activityName}`,
    html: `
      <div style="${styles.container}">
        <div style="${styles.title}">老師您好，有一項借用申請待審核</div>
        <p>以下是學生的教室借用內容：</p>
        <div style="${styles.item}"><span style="${styles.label}">申請人：</span>${userEmail}</div>
        <div style="${styles.item}"><span style="${styles.label}">活動：</span>${activityName}</div>
        <div style="${styles.item}"><span style="${styles.label}">地點：</span>${classroom}</div>
        <div style="${styles.item}"><span style="${styles.label}">時間：</span>${date} ${startTime} - ${endTime}</div>
        
        <a href="${baseUrl}/teacher-signoff?id=${idToUse}" style="${styles.button}">點此前往簽核</a>
        
        <p style="font-size: 13px; color: #999; margin-top: 30px;">這是系統自動發送的訊息，請勿直接回覆。</p>
      </div>
    `,
  });
};

const sendTASignoffMail = async ({
  taEmail,
  borrowId,
  publicId,
  baseUrl,
  comment,
}) => {
  const idToUse = publicId || borrowId;
  const commentHtml = comment
    ? `<div style="${styles.noteBox}"><strong>老師的留言：</strong><br/>${comment}</div>`
    : '';

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: taEmail,
    subject: `【助教覆核】申請單 #${borrowId} 老師已核准`,
    html: `
      <div style="${styles.container}">
        <div style="${styles.title}">助教您好，有新申請需覆核</div>
        <p>申請單 <strong>#${borrowId}</strong> 已經過老師初步簽核，請撥冗進行最後覆核。</p>
        ${commentHtml}
        <a href="${baseUrl}/ta-signoff?id=${idToUse}" style="${styles.button}">進入系統處理</a>
      </div>
    `,
  });
};

const sendApprovalNotification = async ({
  userEmail,
  borrowId,
  eventName,
  classroom,
  startDate,
  startTime,
  endTime,
  comment,
}) => {
  const commentHtml = comment
    ? `<div style="${styles.noteBox}"><strong>管理員備註：</strong><br/>${comment}</div>`
    : '';

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: userEmail,
    subject: `【借用成功】您的教室申請已通過審核`,
    html: `
      <div style="${styles.container}">
        <div style="${styles.title}; color: #28a745;">借用申請已核准！</div>
        <p>同學您好，您的教室借用申請（#${borrowId}）已審核通過。</p>
        <div style="${styles.noteBox}">
          <strong>借用資訊：</strong><br/>
          活動：${eventName}<br/>
          教室：${classroom}<br/>
          時間：${formatDateForDisplay(startDate)} ${formatTimeForDisplay(startTime)} - ${formatTimeForDisplay(endTime)}
        </div>
        ${commentHtml}
        <p>使用完畢後請記得關閉電源、維持場地整潔，謝謝！</p>
      </div>
    `,
  });
};

const sendRejectionNotification = async ({
  userEmail,
  borrowId,
  eventName,
  classroom,
  startDate,
  startTime,
  endTime,
  reason,
}) => {
  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: userEmail,
    subject: `【申請未通過】教室借用狀態通知`,
    html: `
      <div style="${styles.container}">
        <div style="${styles.title}; color: #dc3545;">借用申請未通過</div>
        <p>同學您好，很抱歉，您的教室借用申請（#${borrowId}）已被駁回。</p>
        <div style="${styles.noteBox}">
          <strong>駁回原因：</strong><br/>
          ${reason || '未提供具體原因，建議洽詢相關單位。'}
        </div>
        <p style="font-size: 14px; color: #666;">原申請活動：${eventName}</p>
      </div>
    `,
  });
};

module.exports = {
  sendTeacherSignoffMail,
  sendTASignoffMail,
  sendApprovalNotification,
  sendRejectionNotification,
};