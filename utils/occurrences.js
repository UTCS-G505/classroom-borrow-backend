const dayjs = require('dayjs');

// 單張借用單最多展開的日期數，避免使用者填入超長 end_date 造成無界迴圈
const MAX_OCCURRENCES = 1000;

/**
 * 把一張借用單展開成實際會佔用教室的日期清單。
 *
 * - 單次借用（或多次借用但沒有 repeat_frequency）：只有 start_date 當天
 * - 多次借用 + 每天：start_date 到 end_date 之間的每一天
 * - 多次借用 + 每周：start_date 起每隔 7 天，直到 end_date
 *
 * @param {{borrow_type: string, repeat_frequency: ?string, start_date: *, end_date: *}} booking
 * @param {*} [rangeStart] 只回傳這個日期(含)之後的日期
 * @param {*} [rangeEnd] 只回傳這個日期(含)之前的日期
 * @returns {string[]} 'YYYY-MM-DD' 格式的日期陣列
 */
function expandOccurrences(booking, rangeStart, rangeEnd) {
  const start = dayjs(booking.start_date).startOf('day');
  if (!start.isValid()) return [];

  let end = booking.end_date ? dayjs(booking.end_date).startOf('day') : start;
  // end_date 缺漏或早於 start_date 時，退回只算起始日這一天
  if (!end.isValid() || end.isBefore(start)) end = start;

  const dates = [];
  if (booking.borrow_type !== '多次借用' || !booking.repeat_frequency) {
    dates.push(start);
  } else {
    const step = booking.repeat_frequency === '每周' ? 7 : 1;
    let cursor = start;
    while (!cursor.isAfter(end) && dates.length < MAX_OCCURRENCES) {
      dates.push(cursor);
      cursor = cursor.add(step, 'day');
    }
  }

  const from = rangeStart ? dayjs(rangeStart).startOf('day') : null;
  const to = rangeEnd ? dayjs(rangeEnd).startOf('day') : null;

  return dates
    .filter((d) => (!from || !d.isBefore(from)) && (!to || !d.isAfter(to)))
    .map((d) => d.format('YYYY-MM-DD'));
}

/**
 * 找出兩張借用單第一個重疊的日期（時間段重疊已由 SQL 過濾）。
 * @returns {?string} 重疊日期，沒有重疊則為 null
 */
function findOverlappingDate(occurrenceDates, otherBooking) {
  if (occurrenceDates.length === 0) return null;
  const wanted = new Set(occurrenceDates);
  // 既有單只需展開到新申請涵蓋的範圍，長期單不必整段展開
  const otherDates = expandOccurrences(
    otherBooking,
    occurrenceDates[0],
    occurrenceDates[occurrenceDates.length - 1]
  );
  return otherDates.find((d) => wanted.has(d)) || null;
}

/**
 * 找出借用單第一個撞到固定課表的日期。
 * 需要該天的星期與課程相同，且落在課程的學期區間內。
 * @returns {?string} 衝突日期，沒有衝突則為 null
 */
function findScheduleConflictDate(occurrenceDates, schedule) {
  const semesterStart = dayjs(schedule.semester_start_date).startOf('day');
  const semesterEnd = dayjs(schedule.semester_end_date).startOf('day');

  return (
    occurrenceDates.find((date) => {
      const d = dayjs(date);
      return (
        d.day() === Number(schedule.weekday) &&
        !d.isBefore(semesterStart) &&
        !d.isAfter(semesterEnd)
      );
    }) || null
  );
}

module.exports = {
  expandOccurrences,
  findOverlappingDate,
  findScheduleConflictDate,
  MAX_OCCURRENCES,
};
