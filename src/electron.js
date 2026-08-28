const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let backendRuntime = null;
let cleanupStarted = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    title: 'FB Messenger CRM',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL('http://localhost:5050');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Start Backend Express/WebSocket Server
  try {
    const distServer = path.join(__dirname, '../dist/server/index.js');
    const srcServer = path.join(__dirname, 'server/index.js');

    if (fs.existsSync(distServer)) {
      console.log('[Electron] Loading compiled server from dist/server/index.js');
      backendRuntime = require(distServer);
    } else if (fs.existsSync(srcServer)) {
      console.log('[Electron] Loading server from src/server/index.js');
      backendRuntime = require(srcServer);
    }
  } catch (err) {
    console.error('[Electron] Error starting backend server:', err.message);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (cleanupStarted) return;
  cleanupStarted = true;
  try {
    backendRuntime?.stopManagedProcesses?.();
  } catch (err) {
    console.error('[Electron] Error stopping managed Chrome processes:', err.message);
  }
});
