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

test('createProfessor returns 400 when required fields are missing', async () => {
  const req = { body: { name: '' } };
  const res = createRes();
  await controller.createProfessor(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /缺少必要欄位/);
});

test('createProfessor inserts and returns professor id', async () => {
  const originalQuery = db.query;
  db.query = async () => [{ insertId: 12 }];

  const req = {
    body: { name: '王教授', department: '資工系', phone: '02-1234', email: 'p@test.edu' },
  };
  const res = createRes();
  await controller.createProfessor(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { message: '教授資料已新增', professor_id: 12 });

  db.query = originalQuery;
});

test('updateProfessor returns 400 when no fields to update', async () => {
  const req = { params: { id: '7' }, body: {} };
  const res = createRes();
  await controller.updateProfessor(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, '沒有可更新的欄位');
});

test('updateProfessor returns 404 when professor does not exist', async () => {
  const originalQuery = db.query;
  db.query = async () => [{ affectedRows: 0 }];

  const req = { params: { id: '999' }, body: { name: '新名字' } };
  const res = createRes();
  await controller.updateProfessor(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, '找不到教授資料');

  db.query = originalQuery;
});
