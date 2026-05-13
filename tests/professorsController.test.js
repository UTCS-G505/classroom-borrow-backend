const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../db');
const controller = require('../controllers/professorsController');

function createRes() {
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

async function withMockedQuery(mockImpl, run) {
  const originalQuery = db.query;
  db.query = mockImpl;
  try {
    await run();
  } finally {
    db.query = originalQuery;
  }
}

test('createProfessor returns 400 when required fields are missing', async () => {
  const req = { body: { name: '' } };
  const res = createRes();
  await controller.createProfessor(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /缺少必要欄位/);
});

test('createProfessor inserts and returns professor id', async () => {
  await withMockedQuery(async () => [{ insertId: 12 }], async () => {
    const req = {
      body: {
        name: '王教授',
        department: '資工系',
        phone: '02-1234',
        email: 'p@test.edu',
      },
    };
    const res = createRes();
    await controller.createProfessor(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { message: '教授資料已新增', professor_id: 12 });
  });
});

test('updateProfessor returns 400 when no fields to update', async () => {
  const req = { params: { id: '7' }, body: {} };
  const res = createRes();
  await controller.updateProfessor(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, '沒有可更新的欄位');
});

test('updateProfessor returns 404 when professor does not exist', async () => {
  await withMockedQuery(async () => [{ affectedRows: 0 }], async () => {
    const req = { params: { id: '999' }, body: { name: '新名字' } };
    const res = createRes();
    await controller.updateProfessor(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, '找不到教授資料');
  });
});

test('getProfessors returns rows from database', async () => {
  await withMockedQuery(async () => [[{ professor_id: 1, name: '王教授' }]], async () => {
    const req = { query: {} };
    const res = createRes();
    await controller.getProfessors(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, [{ professor_id: 1, name: '王教授' }]);
  });
});

test('deleteProfessor returns 404 when professor does not exist', async () => {
  await withMockedQuery(async () => [{ affectedRows: 0 }], async () => {
    const req = { params: { id: '404' } };
    const res = createRes();
    await controller.deleteProfessor(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, '找不到教授資料');
  });
});
