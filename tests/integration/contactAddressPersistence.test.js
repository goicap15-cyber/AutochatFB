const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getTestDatabase } = require('../helpers/testDatabase');
const ContactService = require('../../src/server/services/ContactService');

test('persists a manually entered customer address without overwriting phone or email', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autochatbot-address-'));
  const filename = path.join(dir, 'database.db');
  const db = getTestDatabase(filename);
  try {
    db.prepare('INSERT INTO accounts (id, name, profile_dir) VALUES (?, ?, ?)').run('acct-address', 'Address Test', '/tmp/test');
    db.prepare("INSERT INTO threads (id, account_id, contact_name, status, is_unread) VALUES (?, ?, ?, 'UNPROCESSED', 1)").run('address-thread', 'acct-address', 'Nguyễn Văn A');

    const saved = ContactService.update('address-thread', {
      name: 'Nguyễn Văn A',
      phone: '0912345678',
      email: 'a@example.com',
      address: '123 Nguyễn Trãi, Thanh Xuân, Hà Nội'
    }, db);

    assert.equal(saved.address, '123 Nguyễn Trãi, Thanh Xuân, Hà Nội');
    assert.equal(saved.phone, '0912345678');
    assert.equal(saved.email, 'a@example.com');

    const cleared = ContactService.update('address-thread', {
      phone: '0912345678',
      email: 'a@example.com',
      address: ''
    }, db);
    assert.equal(cleared.address, '');
    assert.equal(cleared.phone, '0912345678');
    assert.equal(cleared.email, 'a@example.com');
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
