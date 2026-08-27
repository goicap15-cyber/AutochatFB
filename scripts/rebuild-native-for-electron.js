#!/usr/bin/env node
/**
 * rebuild-native-for-electron.js
 *
 * better-sqlite3 ships a prebuilt binary (prebuilds/<platform>-<arch>.node)
 * and its own lib/binding.js ALWAYS prefers that prebuild over anything
 * built locally - it only checks platform+arch, never the Node ABI version
 * (confirmed by reading lib/binding.js's getPrebuildPath(), which has no ABI
 * check at all). The dev-installed prebuild is built for the SYSTEM Node's
 * ABI, not Electron's - loading it inside a packaged Electron app SEGFAULTS
 * immediately on `new Database(...)` (live-reproduced 2026-08-20, isolated
 * with a minimal repro outside this codebase). electron-builder's own
 * automatic native-rebuild step (and even `buildDependenciesFromSource:
 * true`) don't help either: better-sqlite3's binding.gyp gates real
 * compilation on its own `force_build` gyp variable, which neither of those
 * paths sets - so they silently no-op (just touch stamp files, no .node
 * produced).
 *
 * This script does what actually works, run BEFORE `electron-builder`:
 *  1. Hide the shipped prebuild (rename it) so better-sqlite3's own loader
 *     falls through to build/Release/better_sqlite3.node instead.
 *  2. Force a real node-gyp rebuild against Electron's own ABI/headers
 *     (--force_build=1 is the flag that actually matters here).
 * `restore` mode (run AFTER packaging) undoes step 1 and removes the
 * Electron-ABI build, so `npm start` (system Node) goes back to using the
 * original prebuild - without this, dev mode would crash the same way in
 * the opposite ABI direction.
 *
 * Usage:
 *   node scripts/rebuild-native-for-electron.js prepare
 *   node scripts/rebuild-native-for-electron.js restore
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MODULE_DIR = path.join(__dirname, '../node_modules/better-sqlite3');
const PREBUILD_PATH = path.join(MODULE_DIR, 'prebuilds', `${process.platform}-${process.arch}.node`);
const PREBUILD_BACKUP_PATH = `${PREBUILD_PATH}.hidden-for-electron-build`;
const BUILD_DIR = path.join(MODULE_DIR, 'build');

function getElectronVersion() {
  return require(path.join(__dirname, '../node_modules/electron/package.json')).version;
}

function prepare() {
  if (fs.existsSync(PREBUILD_PATH)) {
    fs.renameSync(PREBUILD_PATH, PREBUILD_BACKUP_PATH);
    console.log(`[rebuild-native] Hid ${PREBUILD_PATH}`);
  } else {
    console.log(`[rebuild-native] No prebuild found at ${PREBUILD_PATH} (already hidden or never existed) - continuing.`);
  }

  if (fs.existsSync(BUILD_DIR)) {
    try {
      fs.rmSync(BUILD_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    } catch (e) {
      console.warn('[rebuild-native] Warning removing build dir:', e.message);
    }
  }

  const electronVersion = getElectronVersion();
  console.log(`[rebuild-native] Building better-sqlite3 from source for Electron ${electronVersion} (this is the real fix, not electron-builder's default rebuild step)...`);
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(npxCmd, [
    '--yes', 'node-gyp', 'rebuild',
    `--target=${electronVersion}`,
    `--arch=${process.arch}`,
    '--dist-url=https://electronjs.org/headers',
    '--force_build=1',
    `--directory=${MODULE_DIR}`
  ], { stdio: 'inherit', cwd: path.join(__dirname, '..'), shell: true });

  const producedNode = path.join(BUILD_DIR, 'Release', 'better_sqlite3.node');
  if (!fs.existsSync(producedNode)) {
    throw new Error(`[rebuild-native] Expected ${producedNode} after rebuild but it's missing - packaging would ship a broken native module.`);
  }
  console.log('[rebuild-native] OK - Electron-ABI better_sqlite3.node is in place.');
}

function restore() {
  if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true });
    console.log(`[rebuild-native] Removed Electron-ABI build dir ${BUILD_DIR}.`);
  }
  if (fs.existsSync(PREBUILD_BACKUP_PATH)) {
    fs.renameSync(PREBUILD_BACKUP_PATH, PREBUILD_PATH);
    console.log(`[rebuild-native] Restored ${PREBUILD_PATH} for dev mode (npm start).`);
  }
}

const mode = process.argv[2];
if (mode === 'prepare') prepare();
else if (mode === 'restore') restore();
else {
  console.error('Usage: node scripts/rebuild-native-for-electron.js <prepare|restore>');
  process.exit(1);
}
