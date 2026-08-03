const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class ProcessManager {
  constructor() {
    this.processes = new Map(); // Key: account_id -> { process, profileDir }
    this.extensionPath = path.join(__dirname, '../../extension');
    this.binChromePath = path.join(__dirname, '../../../bin/chrome-win/chrome.exe');
  }

  // Khởi chạy Chrome Portable ngầm cho tài khoản FB
  startAccountProcess(accountId, customProfileDir = null) {
    if (this.processes.has(accountId)) {
      console.log(`[ProcessManager] Tài khoản ${accountId} đã đang chạy.`);
      return true;
    }

    let profileDir = customProfileDir;
    if (!profileDir) {
      try {
        const db = require('../database/db');
        const acc = db.prepare('SELECT profile_dir FROM accounts WHERE id = ?').get(accountId);
        if (acc?.profile_dir) {
          profileDir = path.isAbsolute(acc.profile_dir)
            ? acc.profile_dir
            : path.join(__dirname, '../../../', acc.profile_dir);
        }
      } catch (e) {}
    }

    if (!profileDir) {
      profileDir = path.join(__dirname, `../../../data/profiles/${accountId}`);
    }

    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    // Nếu không có Chrome Portable local bin, fallback về chrome hệ thống
    const chromeExecutable = fs.existsSync(this.binChromePath) ? this.binChromePath : 'google-chrome';

    const args = [
      `--user-data-dir=${profileDir}`,
      `--load-extension=${this.extensionPath}`,
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--no-first-run',
      '--no-default-browser-check',
      'https://www.facebook.com/messages'
    ];

    console.log(`[ProcessManager] Khởi chạy Chrome Portable cho account ${accountId} (Profile: ${profileDir})...`);
    try {
      const child = spawn(chromeExecutable, args, {
        detached: true,
        stdio: 'ignore'
      });

      child.unref();

      this.processes.set(accountId, {
        process: child,
        profileDir,
        pid: child.pid,
        status: 'RUNNING'
      });

      console.log(`[ProcessManager] Chrome Portable [PID ${child.pid}] khởi chạy thành công.`);
      return true;
    } catch (err) {
      console.error(`[ProcessManager] Lỗi khởi chạy Chrome cho ${accountId}:`, err.message);
      return false;
    }
  }

  // Khởi chạy Chrome Portable cho phiên thêm tài khoản mới (pending session)
  startNewAccountProcess(pendingKey) {
    if (this.processes.has(pendingKey)) {
      console.log(`[ProcessManager] Phiên pending ${pendingKey} đã đang chạy.`);
      return true;
    }

    const profileDir = path.join(__dirname, `../../../data/profiles/${pendingKey}`);
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    const chromeExecutable = fs.existsSync(this.binChromePath) ? this.binChromePath : 'google-chrome';

    const args = [
      `--user-data-dir=${profileDir}`,
      `--load-extension=${this.extensionPath}`,
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--no-first-run',
      '--no-default-browser-check',
      `https://www.facebook.com/messages?crm_pending_key=${pendingKey}`
    ];

    console.log(`[ProcessManager] Khởi chạy Chrome mới cho phiên thêm account [${pendingKey}]...`);
    try {
      const child = spawn(chromeExecutable, args, {
        detached: true,
        stdio: 'ignore'
      });

      child.unref();

      this.processes.set(pendingKey, {
        process: child,
        profileDir,
        pid: child.pid,
        status: 'RUNNING'
      });

      console.log(`[ProcessManager] Chrome pending session [PID ${child.pid}] khởi chạy thành công.`);
      return true;
    } catch (err) {
      console.error(`[ProcessManager] Lỗi khởi chạy Chrome cho phiên ${pendingKey}:`, err.message);
      return false;
    }
  }

  // Bật sáng cửa sổ Chrome GUI khi gặp Checkpoint / OTP 2FA / Session Expired
  unhideWindow(accountId) {
    console.log(`[ProcessManager] CẢNH BÁO: Bật sáng cửa sổ Chrome cho account ${accountId} để xử lý Checkpoint/2FA!`);
    const procInfo = this.processes.get(accountId);
    if (!procInfo) {
      console.warn(`[ProcessManager] Không tìm thấy tiến trình cho account ${accountId}`);
      return false;
    }

    // Gọi lệnh PowerShell trên Windows để đưa cửa sổ Chrome có PID tương ứng lên Foreground
    if (process.platform === 'win32') {
      const psCommand = `
        $app = Get-Process -Id ${procInfo.pid} -ErrorAction SilentlyContinue;
        if ($app) {
          $sig = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);';
          $type = Add-Type -MemberDefinition $sig -Name "Win32SetForegroundWindow" -Namespace Win32Utils -PassThru;
          $type::SetForegroundWindow($app.MainWindowHandle);
        }
      `;
      exec(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`, (err) => {
        if (err) console.error('[ProcessManager] Lỗi đưa cửa sổ Chrome lên foreground:', err.message);
      });
    } else {
      console.log(`[ProcessManager] (Linux/macOS) Vui lòng kiểm tra cửa sổ Chrome PID ${procInfo.pid}`);
    }
    return true;
  }

  // Dừng tiến trình Chrome Portable
  stopAccountProcess(accountId) {
    const procInfo = this.processes.get(accountId);
    if (procInfo && procInfo.process) {
      try {
        procInfo.process.kill();
        this.processes.delete(accountId);
        console.log(`[ProcessManager] Đã dừng tiến trình Chrome account ${accountId}`);
        return true;
      } catch (err) {
        console.error(`[ProcessManager] Lỗi dừng tiến trình ${accountId}:`, err.message);
      }
    }
    return false;
  }

  getStatus(accountId) {
    const procInfo = this.processes.get(accountId);
    return procInfo ? procInfo.status : 'STOPPED';
  }
}

module.exports = new ProcessManager();
