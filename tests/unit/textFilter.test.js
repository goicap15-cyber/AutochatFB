const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

const context = { console };
vm.createContext(context);
vm.runInContext(fs.readFileSync('src/extension/textFilter.js', 'utf8'), context);
const clean = context.FbCrmTextFilter.cleanMessageText;

test('strips Vietnamese accessibility label without losing message content', () => {
  assert.equal(clean('Tin nhắn do Bảo Khánh gửi lúc Thứ Sáu 10:09 sáng: 👍'), '👍');
});

test('strips English accessibility label without losing message content', () => {
  assert.equal(clean('Message sent by Alice at Friday 10:09: hello'), 'hello');
});

test('identifies and rejects system labels as contact names', () => {
  const isInvalid = context.FbCrmTextFilter.isInvalidContactName;
  const cleanContact = context.FbCrmTextFilter.cleanContactName;

  assert.equal(isInvalid('Tất cả tin nhắn'), true);
  assert.equal(isInvalid('Tất cả'), true);
  assert.equal(isInvalid('All messages'), true);
  assert.equal(isInvalid('Hộp thư đến'), true);
  assert.equal(isInvalid('Chưa đọc'), true);
  assert.equal(isInvalid('Đang hoạt động'), true);
  assert.equal(isInvalid('Hoạt động 5 phút trước'), true);
  assert.equal(isInvalid('Facebook'), true);
  assert.equal(isInvalid('Messenger'), true);
  assert.equal(isInvalid('Meta'), true);

  assert.equal(isInvalid('Thu Oanh Nguyen'), false);
  assert.equal(isInvalid('Nguyễn Trường'), false);
  assert.equal(isInvalid('John Doe'), false);

  assert.equal(cleanContact('Tất cả tin nhắn'), 'Khách hàng');
  assert.equal(cleanContact('Thu Oanh Nguyen'), 'Thu Oanh Nguyen');
});

