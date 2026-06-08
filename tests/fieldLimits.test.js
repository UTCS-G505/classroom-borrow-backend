const assert = require('assert');
const { validateFieldLengths, FIELD_LIMITS } = require('../utils/fieldLimits');

function testValidateFieldLengths() {
  // 1. Test valid input
  const validAnnouncement = { title: '這是一個正常的公告標題' };
  const err1 = validateFieldLengths('announcements', validAnnouncement);
  assert.strictEqual(err1, null, 'Valid announcement title should pass');

  // 2. Test input exceeding the limit
  // Max is 100 for announcements.title
  const invalidAnnouncement = { title: 'a'.repeat(101) };
  const err2 = validateFieldLengths('announcements', invalidAnnouncement);
  assert.strictEqual(
    err2,
    '標題長度不可超過 100 個字',
    'Should fail when title is too long'
  );

  // 3. Test exact boundary limit (100 characters)
  const boundaryAnnouncement = { title: 'a'.repeat(100) };
  const err3 = validateFieldLengths('announcements', boundaryAnnouncement);
  assert.strictEqual(err3, null, 'Exact boundary length should pass');

  // 4. Test Unicode/Surrogate pair character length handling (code points)
  // Emoji '𠮷' (U+20BB7) is 1 code point, but 2 characters in length (surrogate pair) in ES5 length.
  // We want to make sure it's counted as 1 code point/character.
  const unicodeAnnouncement = { title: '𠮷'.repeat(100) };
  const err4 = validateFieldLengths('announcements', unicodeAnnouncement);
  assert.strictEqual(err4, null, '100 Unicode code points should pass');

  const tooLongUnicodeAnnouncement = { title: '𠮷'.repeat(101) };
  const err5 = validateFieldLengths(
    'announcements',
    tooLongUnicodeAnnouncement
  );
  assert.strictEqual(
    err5,
    '標題長度不可超過 100 個字',
    '101 Unicode code points should fail'
  );

  // 5. Test missing fields / null or undefined fields (should pass/ignore)
  const partialAnnouncement = { title: undefined };
  const err6 = validateFieldLengths('announcements', partialAnnouncement);
  assert.strictEqual(err6, null, 'Undefined fields should be skipped');

  const nullAnnouncement = { title: null };
  const err7 = validateFieldLengths('announcements', nullAnnouncement);
  assert.strictEqual(err7, null, 'Null fields should be skipped');

  // 6. Test unknown table
  const err8 = validateFieldLengths('non_existent_table', {
    any_field: 'value',
  });
  assert.strictEqual(err8, null, 'Unknown tables should return null');

  console.log('fieldLimits tests passed');
}

testValidateFieldLengths();
