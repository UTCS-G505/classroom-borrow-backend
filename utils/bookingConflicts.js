const {
  findOverlappingDate,
  findScheduleConflictDate,
} = require('./occurrences');

// 與 postBookings 相同的判斷：狀態不是「退件/已取消/已歸還」的申請單都算佔用。
// 先用「時間段重疊 + 日期區間重疊」粗篩，再在 JS 端展開日期比對。
const CHECK_REQUESTS_SQL = `
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

const CHECK_SCHEDULES_SQL = `
  SELECT schedule_id, weekday, semester_start_date, semester_end_date
  FROM class_schedules
  WHERE classroom_id = ?
    AND semester_start_date <= ?
    AND semester_end_date >= ?
    AND start_time < ?
    AND end_time > ?
`;

/**
 * 在交易中檢查一張借用單是否與既有申請單或固定課表衝突。
 * 同一個交易內先前 INSERT 的單子也查得到，因此一次登錄多筆時彼此也會互相檢查。
 *
 * @param {object} connection 已 beginTransaction 的連線
 * @param {{classroom_id: string, start_time: string, end_time: string}} booking
 * @param {string[]} occurrenceDates expandOccurrences 展開後的日期（遞增）
 * @returns {Promise<?{type: 'booking'|'schedule', date: string}>} 第一個衝突，沒有則為 null
 */
async function findBookingConflict(connection, booking, occurrenceDates) {
  if (occurrenceDates.length === 0) return null;

  const firstDate = occurrenceDates[0];
  const lastDate = occurrenceDates[occurrenceDates.length - 1];

  const [requestRows] = await connection.query(CHECK_REQUESTS_SQL, [
    booking.classroom_id,
    booking.end_time,
    booking.start_time,
    lastDate,
    firstDate,
  ]);
  for (const row of requestRows) {
    const date = findOverlappingDate(occurrenceDates, row);
    if (date) return { type: 'booking', date };
  }

  const [scheduleRows] = await connection.query(CHECK_SCHEDULES_SQL, [
    booking.classroom_id,
    lastDate,
    firstDate,
    booking.end_time,
    booking.start_time,
  ]);
  for (const schedule of scheduleRows) {
    const date = findScheduleConflictDate(occurrenceDates, schedule);
    if (date) return { type: 'schedule', date };
  }

  return null;
}

module.exports = { findBookingConflict };
