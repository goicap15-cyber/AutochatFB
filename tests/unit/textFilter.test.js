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
