const assert = require('assert');
const path = require('path');
const dayjs = require('dayjs');

const controllerPath = path.join(
  __dirname,
  '../controllers/adminsController.js'
);
const dbPath = path.join(__dirname, '../db.js');
const emailPath = path.join(__dirname, '../services/emailService.js');

const TERMINAL_STATUSES = ['退件', '已取消', '已歸還'];

function loadController({ pool, emailService }) {
  delete require.cache[controllerPath];
  delete require.cache[dbPath];
  delete require.cache[emailPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: pool,
  };
  require.cache[emailPath] = {
    id: emailPath,
    filename: emailPath,
    loaded: true,
    exports: emailService,
  };

  return require(controllerPath);
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

// 模擬 MySQL：衝突查詢依 SQL 參數過濾，INSERT 的資料同一交易內查得到
function createFakeDb({ requests = [], schedules = [] } = {}) {
  const events = [];
  const inserts = [];
  const rows = requests.map((r) => ({ ...r }));
  let nextId = 100;

  const connection = {
    events,
    inserts,
    beginTransaction: async () => events.push('begin'),
    commit: async () => events.push('commit'),
    rollback: async () => events.push('rollback'),
    release: () => events.push('release'),
    query: async (sql, params) => {
      if (sql.includes('FROM borrow_requests') && sql.includes('FOR UPDATE')) {
        events.push('check-requests');
        const [classroomId, endTime, startTime, lastDate, firstDate] = params;
        return [
          rows.filter(
            (r) =>
              r.classroom_id === classroomId &&
              !TERMINAL_STATUSES.includes(r.status) &&
              r.start_time < endTime &&
              r.end_time > startTime &&
              r.start_date <= lastDate &&
              (r.end_date || r.start_date) >= firstDate
          ),
        ];
      }
      if (sql.includes('FROM class_schedules')) {
        events.push('check-schedules');
        const [classroomId, lastDate, firstDate, endTime, startTime] = params;
        return [
          schedules.filter(
            (s) =>
              s.classroom_id === classroomId &&
              s.semester_start_date <= lastDate &&
              s.semester_end_date >= firstDate &&
              s.start_time < endTime &&
              s.end_time > startTime
          ),
        ];
      }
      if (sql.includes('INSERT INTO borrow_requests')) {
        events.push('insert');
        assert(
          sql.includes("'核准'"),
          'admin bookings must be inserted as 核准'
        );
        const [
          public_id,
          user_id,
          classroom_id,
          borrow_type,
          repeat_frequency,
          start_date,
          end_date,
          start_time,
          end_time,
          event_name,
          people_count,
          reason,
          borrower_department,
          borrower_phone,
          borrower_email,
          borrower_name,
        ] = params;
        const row = {
          request_id: nextId++,
          public_id,
          user_id,
          classroom_id,
          borrow_type,
          repeat_frequency,
          start_date,
          end_date,
          start_time,
          end_time,
          event_name,
          people_count,
          reason,
          borrower_department,
          borrower_phone,
          borrower_email,
          borrower_name,
          status: '核准',
        };
        inserts.push(row);
        rows.push(row);
        return [{ insertId: row.request_id }];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };

  let connectionCount = 0;
  const pool = {
    getConnection: async () => {
      connectionCount += 1;
      return connection;
    },
    get connectionCount() {
      return connectionCount;
    },
  };

  return { pool, connection };
}

function futureDate(daysFromNow = 30) {
  return dayjs().add(daysFromNow, 'day').format('YYYY-MM-DD');
}

function validBooking(overrides = {}) {
  return {
    classroom_id: 'CCHALL',
    borrow_type: '單次借用',
    start_date: futureDate(30),
    start_time: '08:00',
    end_time: '12:00',
    event_name: '年度成果發表會',
    people_count: '300',
    borrower_department: '臺北市某某協會',
    borrower_name: '王小明',
    borrower_phone: '0912-345678',
    borrower_email: '',
    reason: '【場地及設備租借表】選用設備：大型投影機(時) × 1',
    ...overrides,
  };
}

async function callCreate(bookings, { db = createFakeDb(), user } = {}) {
  const emailCalls = [];
  const emailService = new Proxy(
    {},
    {
      get: (_, name) => async (payload) => emailCalls.push({ name, payload }),
    }
  );
  const controller = loadController({ pool: db.pool, emailService });
  const req = {
    user: user === undefined ? { user_id: 'admin-uuid', role: 0 } : user,
    body: { bookings },
  };
  const res = createResponse();
  await controller.createBookings(req, res);
  return { res, db, emailCalls };
}

async function testCreatesApprovedSingleBooking() {
  const booking = validBooking();
  const { res, db, emailCalls } = await callCreate([booking]);

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.message, '已新增 1 筆借用');
  assert.strictEqual(res.body.bookings.length, 1);
  assert.strictEqual(res.body.bookings[0].classroom_id, 'CCHALL');
  assert.match(res.body.bookings[0].public_id, /^[0-9a-f-]{36}$/);

  const [row] = db.connection.inserts;
  assert.strictEqual(row.user_id, 'admin-uuid');
  assert.strictEqual(row.borrow_type, '單次借用');
  assert.strictEqual(row.repeat_frequency, null);
  assert.strictEqual(row.start_date, booking.start_date);
  assert.strictEqual(row.end_date, null);
  assert.strictEqual(row.start_time, '08:00:00');
  assert.strictEqual(row.end_time, '12:00:00');
  assert.strictEqual(row.people_count, 300);
  assert.strictEqual(row.borrower_department, '臺北市某某協會');
  assert.strictEqual(row.borrower_name, '王小明');
  assert.strictEqual(row.reason, booking.reason);

  assert.deepStrictEqual(db.connection.events, [
    'begin',
    'check-requests',
    'check-schedules',
    'insert',
    'commit',
    'release',
  ]);
  assert.strictEqual(emailCalls.length, 0, 'admin booking must not send mail');
}

async function testCreatesDailyRangeBooking() {
  const start = futureDate(40);
  const end = futureDate(42);
  const { res, db } = await callCreate([
    validBooking({
      borrow_type: '多次借用',
      repeat_frequency: '每天',
      start_date: start,
      end_date: end,
    }),
  ]);

  assert.strictEqual(res.statusCode, 201);
  const [row] = db.connection.inserts;
  assert.strictEqual(row.borrow_type, '多次借用');
  assert.strictEqual(row.repeat_frequency, '每天');
  assert.strictEqual(row.start_date, start);
  assert.strictEqual(row.end_date, end);
}

async function testRejectsWhenOverlappingExistingRequest() {
  // 既有單只佔用第 2 天，連續 3 天的新借用必須在第 2 天被擋下
  const start = futureDate(50);
  const middle = futureDate(51);
  const db = createFakeDb({
    requests: [
      {
        request_id: 1,
        classroom_id: 'CCHALL',
        borrow_type: '單次借用',
        repeat_frequency: null,
        start_date: middle,
        end_date: null,
        start_time: '10:00:00',
        end_time: '11:00:00',
        status: '審核中',
      },
    ],
  });

  const { res } = await callCreate(
    [
      validBooking({
        borrow_type: '多次借用',
        repeat_frequency: '每天',
        start_date: start,
        end_date: futureDate(52),
      }),
    ],
    { db }
  );

  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.conflict_type, 'booking');
  assert.strictEqual(res.body.conflict_date, middle);
  assert.strictEqual(res.body.index, 0);
  assert.strictEqual(db.connection.inserts.length, 0);
  assert(db.connection.events.includes('rollback'));
  assert(!db.connection.events.includes('commit'));
  assert(db.connection.events.includes('release'));
}

async function testIgnoresCancelledRequests() {
  const date = futureDate(55);
  const db = createFakeDb({
    requests: [
      {
        request_id: 2,
        classroom_id: 'CCHALL',
        borrow_type: '單次借用',
        repeat_frequency: null,
        start_date: date,
        end_date: null,
        start_time: '08:00:00',
        end_time: '12:00:00',
        status: '已取消',
      },
    ],
  });

  const { res } = await callCreate([validBooking({ start_date: date })], {
    db,
  });
  assert.strictEqual(res.statusCode, 201);
}

async function testRejectsWhenOverlappingClassSchedule() {
  const date = futureDate(60);
  const db = createFakeDb({
    schedules: [
      {
        schedule_id: 9,
        classroom_id: 'CCHALL',
        weekday: dayjs(date).day(),
        start_time: '09:00:00',
        end_time: '10:00:00',
        semester_start_date: futureDate(1),
        semester_end_date: futureDate(120),
      },
    ],
  });

  const { res } = await callCreate([validBooking({ start_date: date })], {
    db,
  });

  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.conflict_type, 'schedule');
  assert.strictEqual(res.body.conflict_date, date);
  assert.strictEqual(db.connection.inserts.length, 0);
}

async function testBatchIsAllOrNothingAndChecksWithinBatch() {
  // 第 2 筆與第 1 筆同場地同時段：第 1 筆已在交易內 INSERT，第 2 筆要被擋下並整批 rollback
  const date = futureDate(70);
  const { res, db } = await callCreate([
    validBooking({ start_date: date }),
    validBooking({ start_date: date, start_time: '11:00', end_time: '13:00' }),
  ]);

  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.index, 1);
  assert.match(res.body.error, /^第 2 筆（CCHALL）/);
  assert(db.connection.events.includes('rollback'));
  assert(!db.connection.events.includes('commit'));
}

async function testBatchOfDifferentVenuesSucceeds() {
  const date = futureDate(80);
  const { res, db } = await callCreate([
    validBooking({ start_date: date }),
    validBooking({ start_date: date, classroom_id: 'GMEET1' }),
  ]);

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.message, '已新增 2 筆借用');
  assert.deepStrictEqual(
    db.connection.inserts.map((r) => r.classroom_id),
    ['CCHALL', 'GMEET1']
  );
  assert.strictEqual(
    db.connection.events.filter((e) => e === 'commit').length,
    1
  );
}

async function testValidationErrors() {
  const cases = [
    [{ classroom_id: '' }, /缺少必要欄位: classroom_id/],
    [{ event_name: '  ' }, /缺少必要欄位: event_name/],
    [{ borrower_department: '' }, /borrower_department/],
    [{ borrower_name: '' }, /borrower_name/],
    [{ classroom_id: 'v1' }, /無效的場地代號/],
    [{ start_date: '2026/12/01' }, /借用日期格式錯誤/],
    [{ start_date: '2099-02-30' }, /借用日期格式錯誤/],
    [
      { start_date: dayjs().subtract(1, 'day').format('YYYY-MM-DD') },
      /不可早於今天/,
    ],
    [{ start_time: '12:00', end_time: '12:00' }, /結束時間必須晚於開始時間/],
    [{ start_time: '25:00' }, /時間格式錯誤/],
    [{ borrow_type: '長期借用' }, /借用類型必須為/],
    [{ borrow_type: '多次借用', end_date: futureDate(40) }, /重複頻率/],
    [
      { borrow_type: '多次借用', repeat_frequency: '每天', end_date: '' },
      /正確的結束日期/,
    ],
    [
      {
        borrow_type: '多次借用',
        repeat_frequency: '每天',
        start_date: futureDate(40),
        end_date: futureDate(39),
      },
      /結束日期不可早於借用日期/,
    ],
    [
      {
        borrow_type: '多次借用',
        repeat_frequency: '每周',
        start_date: futureDate(1),
        end_date: futureDate(400),
      },
      /不可超過一年/,
    ],
    [{ people_count: '-1' }, /人數必須為/],
    [{ people_count: '2.5' }, /人數必須為/],
    [{ borrower_email: 'not-an-email' }, /電子郵件格式錯誤/],
    [{ borrower_name: '王'.repeat(51) }, /借用人姓名長度不可超過 50/],
    [{ reason: '備'.repeat(2001) }, /備註長度不可超過/],
  ];

  for (const [overrides, pattern] of cases) {
    const db = createFakeDb();
    const { res } = await callCreate([validBooking(overrides)], { db });
    assert.strictEqual(
      res.statusCode,
      400,
      `expected 400 for ${JSON.stringify(overrides).slice(0, 80)}`
    );
    assert.match(res.body.error, /^第 1 筆：/);
    assert.match(res.body.error, pattern);
    assert.strictEqual(
      db.pool.connectionCount,
      0,
      'validation errors must not touch the DB'
    );
  }
}

async function testRejectsBadPayloadShapes() {
  for (const bookings of [undefined, [], 'x']) {
    const { res } = await callCreate(bookings);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error, '請至少提供一筆借用資料');
  }

  const tooMany = Array.from({ length: 21 }, () => validBooking());
  const { res } = await callCreate(tooMany);
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body.error, /一次最多新增 20 筆/);
}

async function testRequiresAuthenticatedUserId() {
  const db = createFakeDb();
  const { res } = await callCreate([validBooking()], { db, user: {} });
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(db.pool.connectionCount, 0);
}

async function run() {
  await testCreatesApprovedSingleBooking();
  await testCreatesDailyRangeBooking();
  await testRejectsWhenOverlappingExistingRequest();
  await testIgnoresCancelledRequests();
  await testRejectsWhenOverlappingClassSchedule();
  await testBatchIsAllOrNothingAndChecksWithinBatch();
  await testBatchOfDifferentVenuesSucceeds();
  await testValidationErrors();
  await testRejectsBadPayloadShapes();
  await testRequiresAuthenticatedUserId();
  console.log('adminCreateBookings tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
