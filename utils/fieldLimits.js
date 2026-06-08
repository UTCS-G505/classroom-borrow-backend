// VARCHAR 長度限制，對應 sql/classroom_borrow_system.sql 的欄位定義。
// 於寫入資料庫前驗證，避免 MySQL 因資料過長而拋出
// "Data too long for column" (ER_DATA_TOO_LONG) 錯誤。
const FIELD_LIMITS = {
  announcements: {
    title: { max: 100, label: '標題' },
  },
  borrow_requests: {
    classroom_id: { max: 10, label: '教室代號' },
    event_name: { max: 100, label: '活動名稱' },
    teacher_name: { max: 50, label: '教師姓名' },
    teacher_department: { max: 50, label: '教師系所' },
    teacher_phone: { max: 20, label: '教師電話' },
    teacher_email: { max: 100, label: '教師信箱' },
    borrower_department: { max: 50, label: '借用人系所' },
    borrower_phone: { max: 20, label: '借用人電話' },
    borrower_email: { max: 100, label: '借用人信箱' },
    borrower_name: { max: 50, label: '借用人姓名' },
  },
  class_schedules: {
    classroom_id: { max: 10, label: '教室代號' },
    course_name: { max: 100, label: '課程名稱' },
    teacher_name: { max: 50, label: '教師姓名' },
  },
};

// 檢查 data 內各欄位是否超過對應的 VARCHAR 長度限制。
// 回傳第一個超過限制的錯誤訊息，全部合法則回傳 null。
// 未在 data 中提供 (undefined/null) 的欄位會被略過，方便用於部分更新。
function validateFieldLengths(table, data) {
  const limits = FIELD_LIMITS[table];
  if (!limits) return null;

  for (const [field, { max, label }] of Object.entries(limits)) {
    const value = data[field];
    if (value === undefined || value === null) continue;

    // 以 Unicode 字元數 (code points) 計算，對應 MySQL utf8mb4 的字元長度語意。
    if (typeof value === 'string' && [...value].length > max) {
      return `${label}長度不可超過 ${max} 個字`;
    }
  }

  return null;
}

module.exports = { FIELD_LIMITS, validateFieldLengths };
