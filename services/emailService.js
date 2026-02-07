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
  // Use publicId if available, otherwise fallback to borrowId
  const idToUse = publicId || borrowId;
  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: teacherEmail,
    subject: `【請簽核】申請單 #${borrowId}`,
    html: `
        <p><strong>申請人：</strong> ${userEmail}</p>
        <p><strong>活動：</strong> ${activityName}</p>
        <p><strong>教室：</strong> ${classroom}</p>
        <p><strong>時間：</strong> ${date} ${startTime} - ${endTime}</p>
        <a href="${baseUrl}/teacher-signoff?id=${idToUse}">前往簽核</a>
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
    ? `<p style="background-color: #e3f2fd; padding: 10px; border-radius: 5px; margin-top: 10px;">
         📝 <strong>老師意見：</strong> ${comment}
       </p>`
    : '';

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: taEmail,
    subject: `【需助教覆核】申請單 #${borrowId}`,
    html: `<p>老師已核准。</p>
           ${commentHtml}
           <a href="${baseUrl}/ta-signoff?id=${idToUse}">前往助教簽核</a>`,
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
    ? `<p style="background-color: #e3f2fd; padding: 10px; border-radius: 5px; margin-top: 10px;">
         📝 <strong>助教/系辦備註：</strong> ${comment}
       </p>`
    : '';

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: userEmail,
    subject: `【申請通過】教室借用申請單 #${borrowId} 已核准`,
    html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
            <h2 style="color:green">🎉 恭喜！您的教室借用申請已通過。</h2>
            <p><strong>申請單號：</strong> #${borrowId}</p>
            <p><strong>活動名稱：</strong> ${eventName}</p>
            <p><strong>借用教室：</strong> ${classroom}</p>
            <p><strong>借用日期：</strong> ${formatDateForDisplay(startDate)}</p>
            <p><strong>借用時間：</strong> ${formatTimeForDisplay(startTime)} - ${formatTimeForDisplay(endTime)}</p>
            <hr/>
            <p style="background-color: #e8f5e9; padding: 10px; border-radius: 5px;">
               ✅ <strong>最終狀態：助教已核准 (APPROVED)</strong>
            </p>
            ${commentHtml}
            <p>請記得準時使用教室，並於使用完畢後將場地復原。</p>
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
    subject: `【申請駁回】教室借用申請單 #${borrowId} 未通過`,
    html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
            <h2 style="color:red">⚠️ 很遺憾，您的申請已被駁回。</h2>
            <p><strong>申請單號：</strong> #${borrowId}</p>
            <p><strong>活動名稱：</strong> ${eventName}</p>
            <p><strong>借用教室：</strong> ${classroom}</p>
            <p><strong>借用日期：</strong> ${formatDateForDisplay(startDate)}</p>
            <p><strong>借用時間：</strong> ${formatTimeForDisplay(startTime)} - ${formatTimeForDisplay(endTime)}</p>
            <hr/>
            <p style="background-color: #ffebee; padding: 10px; border-radius: 5px;">
               ❌ <strong>駁回理由：</strong> ${reason || '未提供理由'}
            </p>
            <p>如有疑問，請聯繫相關管理單位。</p>
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
