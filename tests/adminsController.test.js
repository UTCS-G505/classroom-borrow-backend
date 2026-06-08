const assert = require('assert');
const Module = require('module');
const path = require('path');

const controllerPath = path.join(
  __dirname,
  '../controllers/adminsController.js'
);
const dbPath = path.join(__dirname, '../db.js');
const emailPath = path.join(__dirname, '../services/emailService.js');

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

async function withMockedModule(moduleName, mock, callback) {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === moduleName) return mock;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return await callback();
  } finally {
    Module._load = originalLoad;
  }
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

function createConnection({ requestData, conflictRows = [] }) {
  const events = [];

  return {
    events,
    beginTransaction: async () => {
      events.push('begin');
    },
    query: async (sql) => {
      if (sql.includes('SELECT * FROM borrow_requests')) {
        events.push('select-request');
        return [[requestData]];
      }
      if (sql.includes('SELECT request_id FROM borrow_requests')) {
        events.push('check-conflict');
        return [conflictRows];
      }
      if (sql.includes('UPDATE borrow_requests SET status')) {
        events.push('update-request');
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    commit: async () => {
      events.push('commit');
    },
    rollback: async () => {
      events.push('rollback');
    },
    release: () => {
      events.push('release');
    },
  };
}

function getFutureDate(daysFromNow = 30) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split('T')[0];
}

function createRequestData(overrides = {}) {
  return {
    request_id: 42,
    status: '審核中',
    classroom_id: 'G312',
    start_date: getFutureDate(),
    end_date: null,
    start_time: '10:00:00',
    end_time: '12:00:00',
    borrower_email: 'student@example.edu',
    event_name: '期末專題討論',
    ...overrides,
  };
}

async function testApprovedSendsBorrowerEmailAfterCommit() {
  const requestData = createRequestData({ end_date: getFutureDate(35) });
  const connection = createConnection({ requestData });
  const emailCalls = [];
  const events = connection.events;

  const controller = loadController({
    pool: {
      getConnection: async () => connection,
    },
    emailService: {
      sendApprovalNotification: async (payload) => {
        events.push('send-approval-email');
        emailCalls.push(payload);
      },
    },
  });

  const req = {
    params: { id: String(requestData.request_id) },
    body: { status: 'approved' },
  };
  const res = createResponse();

  await controller.updateBookings(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, {
    success: true,
    message: '已完成: 核准',
    status: '核准',
  });
  assert.deepStrictEqual(emailCalls, [
    {
      userEmail: requestData.borrower_email,
      borrowId: requestData.request_id,
      eventName: requestData.event_name,
      classroom: requestData.classroom_id,
      startDate: requestData.start_date,
      endDate: requestData.end_date,
      startTime: requestData.start_time,
      endTime: requestData.end_time,
      comment: null,
    },
  ]);
  assert(
    events.indexOf('commit') < events.indexOf('send-approval-email'),
    'approval email should be sent after the transaction commits'
  );
}

async function testRejectedDoesNotSendApprovalEmail() {
  const requestData = createRequestData();
  const connection = createConnection({ requestData });
  let approvalEmailCount = 0;

  const controller = loadController({
    pool: {
      getConnection: async () => connection,
    },
    emailService: {
      sendApprovalNotification: async () => {
        approvalEmailCount += 1;
      },
    },
  });

  const req = {
    params: { id: String(requestData.request_id) },
    body: { status: 'rejected', reject_reason: '時段不符合規定' },
  };
  const res = createResponse();

  await controller.updateBookings(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, {
    success: true,
    message: '已完成: 退件',
    status: '退件',
  });
  assert.strictEqual(approvalEmailCount, 0);
}

async function testApprovalEmailRendersDateRange() {
  const sentEmails = [];

  delete require.cache[emailPath];

  await withMockedModule(
    'nodemailer',
    {
      createTransport: () => ({
        sendMail: async (email) => {
          sentEmails.push(email);
        },
      }),
    },
    async () => {
      const emailService = require(emailPath);

      await emailService.sendApprovalNotification({
        userEmail: 'student@example.edu',
        borrowId: 42,
        eventName: '期末專題討論',
        classroom: 'G312',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        startTime: '10:00:00',
        endTime: '12:00:00',
        comment: null,
      });
    }
  );

  assert.strictEqual(sentEmails.length, 1);
  assert(
    sentEmails[0].html.includes('時間：2026-06-01 ~ 2026-06-05 10:00 - 12:00'),
    'approval email should render the full approved date range'
  );
}

async function testTeacherSignoffEmailRendersDateRange() {
  const sentEmails = [];

  delete require.cache[emailPath];

  await withMockedModule(
    'nodemailer',
    {
      createTransport: () => ({
        sendMail: async (email) => {
          sentEmails.push(email);
        },
      }),
    },
    async () => {
      const emailService = require(emailPath);

      await emailService.sendTeacherSignoffMail({
        teacherEmail: 'teacher@example.edu',
        borrowId: 42,
        userEmail: 'U11216028@go.utaipei.edu.tw',
        activityName: 'test',
        classroom: 'G312',
        date: '2026-06-01',
        endDate: '2026-06-05',
        startTime: '12:10',
        endTime: '13:00',
        baseUrl: 'http://localhost:5173',
        publicId: 'public-id',
      });
    }
  );

  assert.strictEqual(sentEmails.length, 1);
  assert(
    sentEmails[0].html.includes(
      '時間：</span>2026-06-01 ~ 2026-06-05 12:10 - 13:00'
    ),
    'teacher signoff email should render the full requested date range'
  );
}

async function run() {
  await testApprovedSendsBorrowerEmailAfterCommit();
  await testRejectedDoesNotSendApprovalEmail();
  await testApprovalEmailRendersDateRange();
  await testTeacherSignoffEmailRendersDateRange();
  console.log('adminsController tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
