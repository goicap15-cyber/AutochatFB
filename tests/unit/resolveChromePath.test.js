const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveChromePath, BUNDLED_CHROME_RELATIVE_PATH } = require('../../chrome-bundling/resolveChromePath');

function makeFakeRepoRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-chrome-test-'));
  return dir;
}

function touchFile(repoRoot, relative) {
  const full = path.join(repoRoot, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, '');
}

test('uses the bundled path for the current platform when it exists on disk', () => {
  const repoRoot = makeFakeRepoRoot();
  touchFile(repoRoot, BUNDLED_CHROME_RELATIVE_PATH[process.platform]);
  const result = resolveChromePath({ repoRoot });
  assert.equal(result, path.join(repoRoot, BUNDLED_CHROME_RELATIVE_PATH[process.platform]));
  fs.rmSync(repoRoot, { recursive: true, force: true });
});

test('falls back to legacyBinChromePath when the new bundled path is missing (no regression, spec 046)', () => {
  const repoRoot = makeFakeRepoRoot();
  const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-chrome-legacy-'));
  const legacyPath = path.join(legacyDir, 'chrome.exe');
  fs.writeFileSync(legacyPath, '');

  const result = resolveChromePath({ repoRoot, legacyBinChromePath: legacyPath });
  assert.equal(result, legacyPath);

  fs.rmSync(repoRoot, { recursive: true, force: true });
  fs.rmSync(legacyDir, { recursive: true, force: true });
});

test('falls back to the literal "google-chrome" command when nothing else exists (pre-spec-046 behavior preserved)', () => {
  const repoRoot = makeFakeRepoRoot();
  const result = resolveChromePath({ repoRoot, legacyBinChromePath: path.join(repoRoot, 'does-not-exist.exe') });
  assert.equal(result, 'google-chrome');
  fs.rmSync(repoRoot, { recursive: true, force: true });
});

test('never throws when legacyBinChromePath is omitted entirely', () => {
  const repoRoot = makeFakeRepoRoot();
  assert.doesNotThrow(() => resolveChromePath({ repoRoot }));
  fs.rmSync(repoRoot, { recursive: true, force: true });
});
