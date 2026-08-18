const test = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const {
  validateAttachment,
  buildStoragePath,
  isSafeArchiveEntryPath,
  validateZipArchiveEntries,
  validateAttachmentAsync
} = require(process.cwd() + '/src/server/services/attachmentValidation');

test('Spec 040 accepts arbitrary declared file types and preserves checksum', () => {
  const result = validateAttachment({
    buffer: Buffer.from('hello, campaign'),
    originalName: 'Báo cáo tháng 8.csv',
    declaredMimeType: 'text/csv',
    allowAnyFile: true,
    maxBytes: 1024
  });
  assert.equal(result.mediaType, 'file');
  assert.equal(result.mimeType, 'text/csv');
  assert.equal(result.safeName, 'Bao_cao_thang_8.csv');
  assert.match(buildStoragePath('/tmp/campaign-attachments', result.checksum, result.mimeType), /\.csv$/);
});

test('Spec 040 rejects executable risk before queueing', () => {
  assert.throws(() => validateAttachment({
    buffer: Buffer.from('not really executable'),
    originalName: 'run.exe',
    declaredMimeType: 'application/octet-stream',
    allowAnyFile: true,
    maxBytes: 1024
  }), (error) => error.code === 'ATTACHMENT_EXECUTABLE_RISK');
});

test('isSafeArchiveEntryPath accepts normal relative paths, rejects traversal/absolute/drive paths', () => {
  assert.equal(isSafeArchiveEntryPath('folder/file.txt'), true);
  assert.equal(isSafeArchiveEntryPath('a/b/c.png'), true);
  assert.equal(isSafeArchiveEntryPath('folder/'), true, 'a directory entry with a trailing slash is safe');
  assert.equal(isSafeArchiveEntryPath('../evil.txt'), false);
  assert.equal(isSafeArchiveEntryPath('a/../../evil.txt'), false);
  assert.equal(isSafeArchiveEntryPath('/etc/passwd'), false);
  assert.equal(isSafeArchiveEntryPath('C:/Windows/system.ini'), false);
  assert.equal(isSafeArchiveEntryPath('\\\\server\\share\\file'), false);
  assert.equal(isSafeArchiveEntryPath(''), false);
  assert.equal(isSafeArchiveEntryPath('a//b.txt'), false, 'empty segment from a double slash is unsafe');
});

test('validateZipArchiveEntries accepts a normal archive and reports entry/byte counts', async () => {
  const zip = new JSZip();
  zip.file('a.txt', 'hello');
  zip.file('sub/b.txt', 'world!!');
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const stats = await validateZipArchiveEntries(buffer);
  assert.equal(stats.totalUncompressedBytes, 'hello'.length + 'world!!'.length);
});

test('validateZipArchiveEntries rejects a traversal entry inside the archive', async () => {
  const zip = new JSZip();
  zip.file('../evil.txt', 'pwn');
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await assert.rejects(
    () => validateZipArchiveEntries(buffer),
    (error) => error.code === 'ATTACHMENT_ARCHIVE_UNSAFE'
  );
});

test('validateZipArchiveEntries rejects a symlink entry inside the archive', async () => {
  const zip = new JSZip();
  // Mode 0xA1FF: S_IFLNK (0xA000) | rwxrwxrwx - a symlink member.
  zip.file('link', 'target.txt', { unixPermissions: 0xa1ff });
  const buffer = await zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' });
  await assert.rejects(
    () => validateZipArchiveEntries(buffer),
    (error) => error.code === 'ATTACHMENT_ARCHIVE_UNSAFE'
  );
});

test('validateZipArchiveEntries rejects an archive with too many entries', async () => {
  const zip = new JSZip();
  for (let i = 0; i < 5; i++) zip.file(`file-${i}.txt`, 'x');
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await assert.rejects(
    () => validateZipArchiveEntries(buffer, { maxEntries: 3 }),
    (error) => error.code === 'ATTACHMENT_ARCHIVE_UNSAFE'
  );
});

test('validateAttachmentAsync validates a safe zip file end-to-end and rejects an unsafe one', async () => {
  const safeZip = new JSZip();
  safeZip.file('report.csv', 'a,b,c');
  const safeBuffer = await safeZip.generateAsync({ type: 'nodebuffer' });
  const result = await validateAttachmentAsync({
    buffer: safeBuffer,
    originalName: 'report.zip',
    declaredMimeType: 'application/zip',
    allowAnyFile: true,
    maxBytes: 1024 * 1024
  });
  assert.equal(result.mimeType, 'application/zip');
  assert.equal(result.archive.entryCount, 1);

  const unsafeZip = new JSZip();
  unsafeZip.file('../evil.txt', 'pwn');
  const unsafeBuffer = await unsafeZip.generateAsync({ type: 'nodebuffer' });
  await assert.rejects(
    () => validateAttachmentAsync({
      buffer: unsafeBuffer,
      originalName: 'evil.zip',
      declaredMimeType: 'application/zip',
      allowAnyFile: true,
      maxBytes: 1024 * 1024
    }),
    (error) => error.code === 'ATTACHMENT_ARCHIVE_UNSAFE'
  );
});
