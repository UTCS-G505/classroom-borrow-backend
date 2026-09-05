const assert = require('assert');
const {
  expandOccurrences,
  findOverlappingDate,
  findScheduleConflictDate,
  MAX_OCCURRENCES,
} = require('../utils/occurrences');

// 2025-09-01 是星期一
const WEEKLY = {
  borrow_type: '多次借用',
  repeat_frequency: '每周',
  start_date: '2025-09-01',
  end_date: '2025-09-29',
};
const DAILY = {
  borrow_type: '多次借用',
  repeat_frequency: '每天',
  start_date: '2025-09-01',
  end_date: '2025-09-05',
};
const single = (date) => ({
  borrow_type: '單次借用',
  repeat_frequency: null,
  start_date: date,
  end_date: null,
});

function testExpandOccurrences() {
  assert.deepStrictEqual(
    expandOccurrences(single('2025-09-15')),
    ['2025-09-15'],
    '單次借用只佔用起始日'
  );

  assert.deepStrictEqual(
    expandOccurrences(DAILY),
    ['2025-09-01', '2025-09-02', '2025-09-03', '2025-09-04', '2025-09-05'],
    '每天借用應展開成連續日期'
  );

  assert.deepStrictEqual(
    expandOccurrences(WEEKLY),
    ['2025-09-01', '2025-09-08', '2025-09-15', '2025-09-22', '2025-09-29'],
    '每周借用應每隔七天展開'
  );

  // end_date 缺漏 / 早於 start_date 時，退回只算起始日
  assert.deepStrictEqual(
    expandOccurrences({ ...DAILY, end_date: null }),
    ['2025-09-01'],
    '缺少 end_date 時只算起始日'
  );
  assert.deepStrictEqual(
    expandOccurrences({ ...DAILY, end_date: '2025-08-01' }),
    ['2025-09-01'],
    'end_date 早於 start_date 時只算起始日'
  );

  // 多次借用但沒填 repeat_frequency
  assert.deepStrictEqual(
    expandOccurrences({ ...DAILY, repeat_frequency: null }),
    ['2025-09-01'],
    '沒有 repeat_frequency 時只算起始日'
  );

  // mysql2 的 DATE 欄位會回傳 Date 物件
  assert.deepStrictEqual(
    expandOccurrences(single(new Date(2025, 8, 15))),
    ['2025-09-15'],
    '應接受 Date 物件'
  );

  // 範圍限制
  assert.deepStrictEqual(
    expandOccurrences(WEEKLY, '2025-09-08', '2025-09-15'),
    ['2025-09-08', '2025-09-15'],
    '應只回傳範圍內的日期'
  );

  // 超長區間要被 MAX_OCCURRENCES 擋住
  assert.strictEqual(
    expandOccurrences({ ...DAILY, end_date: '2099-01-01' }).length,
    MAX_OCCURRENCES,
    '展開數量應受上限保護'
  );
}

function testFindOverlappingDate() {
  // 修復前的漏洞：新的單次申請落在既有多次借用的第三週
  assert.strictEqual(
    findOverlappingDate(expandOccurrences(single('2025-09-15')), WEEKLY),
    '2025-09-15',
    '單次申請應該撞到既有每周借用的中間某一次'
  );

  // 反向：新的多次申請撞到既有的單次借用
  assert.strictEqual(
    findOverlappingDate(expandOccurrences(WEEKLY), single('2025-09-22')),
    '2025-09-22',
    '每周申請應該撞到既有的單次借用'
  );

  // 每周(一) 與 每周(二) 不該衝突
  assert.strictEqual(
    findOverlappingDate(expandOccurrences(single('2025-09-16')), WEEKLY),
    null,
    '不同星期不應衝突'
  );

  // 期間完全錯開
  assert.strictEqual(
    findOverlappingDate(expandOccurrences(single('2025-10-06')), WEEKLY),
    null,
    '超出借用期間不應衝突'
  );

  assert.strictEqual(
    findOverlappingDate([], WEEKLY),
    null,
    '沒有日期時不應衝突'
  );
}

function testFindScheduleConflictDate() {
  const mondayClass = {
    weekday: 1,
    semester_start_date: '2025-09-01',
    semester_end_date: '2026-01-15',
  };
  const wednesdayClass = { ...mondayClass, weekday: 3 };
  const endedClass = { ...mondayClass, semester_end_date: '2025-08-31' };

  assert.strictEqual(
    findScheduleConflictDate(expandOccurrences(WEEKLY), mondayClass),
    '2025-09-01',
    '每周(一)借用應撞到週一的課'
  );

  // 修復前的誤判：只比對學期區間重疊，週三的課也會擋下週一的借用
  assert.strictEqual(
    findScheduleConflictDate(expandOccurrences(WEEKLY), wednesdayClass),
    null,
    '每周(一)借用不該被週三的課擋下'
  );

  // 每天借用會撞到任何一天的課
  assert.strictEqual(
    findScheduleConflictDate(expandOccurrences(DAILY), wednesdayClass),
    '2025-09-03',
    '每天借用應撞到週三的課'
  );

  assert.strictEqual(
    findScheduleConflictDate(expandOccurrences(WEEKLY), endedClass),
    null,
    '學期已結束的課不應造成衝突'
  );

  assert.strictEqual(
    findScheduleConflictDate(expandOccurrences(single('2025-09-15')), {
      ...mondayClass,
      weekday: '1', // MySQL TINYINT 可能以字串回傳
    }),
    '2025-09-15',
    'weekday 為字串時仍應比對成功'
  );
}

testExpandOccurrences();
testFindOverlappingDate();
testFindScheduleConflictDate();
console.log('✅ occurrences.test.js 全部通過');
