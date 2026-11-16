const assert = require('assert');
const path = require('path');
const dayjs = require('dayjs');

const controllerPath = path.join(
  __dirname,
  '../controllers/borrowRequestsController.js'
);
const dbPath = path.join(__dirname, '../db.js');
const emailPath = path.join(__dirname, '../services/emailService.js');

// 前端 BorrowRequestView「選擇教室」選單的所有選項，後端必須全部接受
const FORM_VENUES = [
  'G312',
  'G313',
  'G314',
  'G315',
  'G316',
  'G501',
  'G508',
  'G509',
  'G516',
  'GMEET1',
  'GMEET2',
  'GMEET3',
  'CCHALL',
  'ADM201',
  'C507',
  'C509',
  'C611',
  'C613',
  'C617',
  'D810',
  'INTLHALL',
];

function loadController() {
  const inserts = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params) => {
      if (sql.includes('FROM borrow_requests')) return [[]];
      if (sql.includes('FROM class_schedules')) return [[]];
      if (sql.includes('INSERT INTO borrow_requests')) {
        inserts.push(params);
        return [{ insertId: inserts.length }];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  const pool = {
    // 黑名單查詢
    query: async () => [[]],
    getConnection: async () => connection,
  };

  delete require.cache[controllerPath];
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
    exports: { sendTeacherSignoffMail: async () => {} },
  };

  return { controller: require(controllerPath), inserts };
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

function booking(overrides = {}) {
  return {
    classroom_id: 'G312',
    borrow_type: '單次借用',
    start_date: dayjs().add(30, 'day').format('YYYY-MM-DD'),
    start_time: '10:00',
    end_time: '12:00',
    event_name: '社團活動',
    people_count: 20,
    teacher_name: '王老師',
    reason: '迎新',
    teacher_department: '資科系',
    teacher_phone: '02-1234-5678',
    teacher_email: 'teacher@example.edu',
    borrower_department: '資科系',
    borrower_phone: '0912-000001',
    borrower_email: 'student@example.edu',
    borrower_name: '陳同學',
    ...overrides,
  };
}

async function post(body) {
  const { controller, inserts } = loadController();
  const res = createResponse();
  await controller.postBookings(
    { user: { user_id: 'user-uuid', role: 4 }, body },
    res
  );
  return { res, inserts };
}

async function testAcceptsEveryVenueOfferedByTheForm() {
  for (const classroom_id of FORM_VENUES) {
    const { res, inserts } = await post(booking({ classroom_id }));
    assert.strictEqual(
      res.statusCode,
      200,
      `${classroom_id} should be accepted, got ${JSON.stringify(res.body)}`
    );
    assert.strictEqual(res.body.message, '申請已建立');
    assert.strictEqual(inserts.length, 1);
  }
}

async function testRejectsVenuesNotOfferedToUsers() {
  // 游泳池等場地只開放管理員依租借表登錄，一般申請不可直接送出
  for (const classroom_id of ['GPOOL', 'TRACK', 'v1', 'X999']) {
    const { res, inserts } = await post(booking({ classroom_id }));
    assert.strictEqual(res.statusCode, 400, classroom_id);
    assert.strictEqual(res.body.error, '無效的教室代號');
    assert.strictEqual(inserts.length, 0);
  }
}

async function testOptionalContactFieldsMayBeOmitted() {
  // 先前把 const 解構的變數重新賦值，缺這些欄位時會 TypeError → 500
  const { res, inserts } = await post(
    booking({
      teacher_department: undefined,
      teacher_phone: undefined,
      teacher_email: undefined,
      borrower_department: undefined,
      borrower_phone: undefined,
      borrower_email: undefined,
    })
  );
  assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
  // INSERT 參數第 16~21 個是上述 6 個欄位，未填時寫入空字串
  assert.deepStrictEqual(inserts[0].slice(15, 21), ['', '', '', '', '', '']);
}

async function run() {
  await testAcceptsEveryVenueOfferedByTheForm();
  await testRejectsVenuesNotOfferedToUsers();
  await testOptionalContactFieldsMayBeOmitted();
  console.log('postBookingsVenues tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
