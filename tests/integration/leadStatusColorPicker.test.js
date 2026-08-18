const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getTestDatabase } = require('../helpers/testDatabase');
const LeadStatusService = require('../../src/server/services/LeadStatusService');

function withDatabase(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autochatbot-test-'));
  const filename = path.join(dir, 'database.db');
  const db = getTestDatabase(filename);
  try {
    return run(db);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function createLeadStatus(reqBody, db) {
  try {
    return { status: 200, body: LeadStatusService.create(reqBody, db) };
  } catch (error) {
    if (error instanceof LeadStatusService.LeadStatusValidationError) {
      return { status: 400, body: { error: error.message } };
    }
    throw error;
  }
}

test('POST /api/lead-statuses creates new status with canonical uppercase hex color', () => withDatabase((db) => {
  const res = createLeadStatus({ name: 'Đã hẹn gọi lại', color: '#176ccd' }, db);
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Đã hẹn gọi lại');
  assert.equal(res.body.color, '#176CCD');
  assert.ok(res.body.id > 0);

  const saved = db.prepare('SELECT * FROM lead_statuses WHERE id = ?').get(res.body.id);
  assert.equal(saved.name, 'Đã hẹn gọi lại');
  assert.equal(saved.color, '#176CCD');
}));

test('POST /api/lead-statuses trims whitespace from name and color', () => withDatabase((db) => {
  const res = createLeadStatus({ name: '  Khách Tiềm Năng VIP  ', color: '  #0fbd74  ' }, db);
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Khách Tiềm Năng VIP');
  assert.equal(res.body.color, '#0FBD74');
}));

test('POST /api/lead-statuses returns existing status on duplicate name without creating duplicate rows', () => withDatabase((db) => {
  const first = createLeadStatus({ name: 'Trạng thái trùng', color: '#2684FF' }, db);
  const countBefore = db.prepare('SELECT COUNT(*) AS count FROM lead_statuses').get().count;

  const second = createLeadStatus({ name: 'Trạng thái trùng', color: '#FF0000' }, db);
  const countAfter = db.prepare('SELECT COUNT(*) AS count FROM lead_statuses').get().count;

  assert.equal(second.status, 200);
  assert.equal(second.body.id, first.body.id);
  assert.equal(second.body.color, '#2684FF'); // Preserves original color
  assert.equal(countBefore, countAfter);
}));

test('POST /api/lead-statuses rejects empty/missing name with 400', () => withDatabase((db) => {
  assert.equal(createLeadStatus({ name: '', color: '#176CCD' }, db).status, 400);
  assert.equal(createLeadStatus({ name: '   ', color: '#176CCD' }, db).status, 400);
  assert.equal(createLeadStatus({ color: '#176CCD' }, db).status, 400);
  assert.equal(createLeadStatus(null, db).status, 400);
}));

test('POST /api/lead-statuses rejects short hex, alpha hex, named colors, and invalid hex with 400', () => withDatabase((db) => {
  assert.equal(createLeadStatus({ name: 'Test', color: '#FFF' }, db).status, 400);
  assert.equal(createLeadStatus({ name: 'Test', color: '#176CCD80' }, db).status, 400);
  assert.equal(createLeadStatus({ name: 'Test', color: 'red' }, db).status, 400);
  assert.equal(createLeadStatus({ name: 'Test', color: '176CCD' }, db).status, 400);
  assert.equal(createLeadStatus({ name: 'Test', color: '#GGGGGG' }, db).status, 400);
  assert.equal(createLeadStatus({ name: 'Test', color: '' }, db).status, 400);
  assert.equal(createLeadStatus({ name: 'Test', color: null }, db).status, 400);
}));
