// Resolves the writable "data/" root directory this app uses for its SQLite
// DB, media/attachment files, exports, and Chrome account profiles.
//
// Dev (`npm start`, plain Node, no Electron): the project's own src/../../data
// folder - identical to the path every one of these files hard-coded before,
// so dev behavior is completely unchanged.
//
// Packaged app (Electron, server code loaded from inside app.asar): app.asar
// is a read-only archive - trying to mkdir/write anywhere under it fails
// (live-reproduced 2026-08-20: "ENOTDIR: not a directory, mkdir
// '.../app.asar/data'" on first launch of the packaged AppImage). Falls back
// to Electron's own per-OS writable userData directory instead (e.g.
// ~/.config/<app>/data on Linux, %APPDATA%/<app>/data on Windows,
// ~/Library/Application Support/<app>/data on Mac).
const path = require('path');

function computeAppDataRoot() {
  try {
    // require('electron') returns the app API only when actually running
    // inside an Electron process (this server is require()'d from
    // src/electron.js's app.whenReady() callback in the packaged build) -
    // from plain `node` (dev/test) it returns the executable path string
    // instead, so `.app` is undefined there and this falls through to dev.
    const electron = require('electron');
    if (electron && electron.app && typeof electron.app.getPath === 'function') {
      return path.join(electron.app.getPath('userData'), 'data');
    }
  } catch (_) { /* electron not resolvable from this context - dev/test via plain node */ }
  return path.join(__dirname, '../../../data');
}

const APP_DATA_ROOT = computeAppDataRoot();

module.exports = { APP_DATA_ROOT };
