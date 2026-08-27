const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { resolveChromePath } = require('../../../chrome-bundling/resolveChromePath');
const { resolveExtensionPath, resolveBinRoot } = require('../utils/appResourceRoot');
const { APP_DATA_ROOT } = require('../utils/appDataRoot');

// Ẩn cửa sổ Chrome khỏi màn hình và taskbar Windows bằng Win32 API
function hideFromTaskbar(pid, delayMs = 2500) {
  if (process.platform !== 'win32') return;
  const psScript = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class WinHelper {
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int n, int v);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
}
'@ -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds ${delayMs}

$targetPids = @()
if (${pid || 0}) {
  $targetPids += ${pid}
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = ${pid}" -ErrorAction SilentlyContinue
  if ($children) { foreach ($c in $children) { $targetPids += $c.ProcessId } }
}

$crmProcs = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like '*profiles*' -and $_.CommandLine -notlike '*pending_*' }
if ($crmProcs) { foreach ($c in $crmProcs) { $targetPids += $c.ProcessId } }

$allChrome = Get-Process -Name 'chrome' -ErrorAction SilentlyContinue
foreach ($p in $allChrome) {
  if ($targetPids.Count -eq 0 -or $targetPids -contains $p.Id) {
    if ($p.MainWindowHandle -ne 0) {
      $hwnd = $p.MainWindowHandle
      $ex = [WinHelper]::GetWindowLong($hwnd, -20)
      $ex = ($ex -band -bnot 0x00040000) -bor 0x00000080
      [WinHelper]::SetWindowLong($hwnd, -20, $ex) | Out-Null
      [WinHelper]::ShowWindow($hwnd, 0) | Out-Null
    }
  }
}
`;
  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
  exec(`powershell -NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ${encoded}`, (err) => {
    if (err) console.error('[ProcessManager] Lỗi ẩn Chrome khỏi màn hình/taskbar:', err.message);
  });
}

// Tự động cấp quyền (Micro, Camera, Popups, Notifications) cho Facebook trong Chrome Profile Preferences
function ensureProfilePermissions(profileDir) {
  try {
    const defaultDir = path.join(profileDir, 'Default');
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    const prefPath = path.join(defaultDir, 'Preferences');
    let prefs = {};
    if (fs.existsSync(prefPath)) {
      try {
        prefs = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
      } catch (e) {
        prefs = {};
      }
    }

    if (!prefs.profile) prefs.profile = {};
    if (!prefs.profile.content_settings) prefs.profile.content_settings = {};

    // 1. Chuyển mặc định Default behavior thành Allow (1) cho tất cả các trang
    if (!prefs.profile.content_settings.default_content_setting_values) {
      prefs.profile.content_settings.default_content_setting_values = {};
    }
    prefs.profile.content_settings.default_content_setting_values.popups = 1; // 1 = Allow popups
    prefs.profile.content_settings.default_content_setting_values.media_stream_mic = 1; // 1 = Allow mic
    prefs.profile.content_settings.default_content_setting_values.media_stream_camera = 1; // 1 = Allow camera
    prefs.profile.content_settings.default_content_setting_values.notifications = 1; // 1 = Allow notifications

    // 2. Kích hoạt Developer Mode cho Extensions
    if (!prefs.extensions) prefs.extensions = {};
    if (!prefs.extensions.ui) prefs.extensions.ui = {};
    prefs.extensions.ui.developer_mode = true;

    // 3. Thêm danh sách ngoại lệ Allow riêng cho Facebook & Messenger
    if (!prefs.profile.content_settings.exceptions) prefs.profile.content_settings.exceptions = {};

    const origins = [
      'https://www.facebook.com:443,*',
      'https://facebook.com:443,*',
      'https://*.facebook.com:443,*',
      'https://www.messenger.com:443,*',
      'https://messenger.com:443,*',
      'https://*.messenger.com:443,*'
    ];

    const settingTypes = ['popups', 'media_stream_mic', 'media_stream_camera', 'notifications', 'automatic_downloads'];

    settingTypes.forEach((type) => {
      if (!prefs.profile.content_settings.exceptions[type]) {
        prefs.profile.content_settings.exceptions[type] = {};
      }
      origins.forEach((origin) => {
        prefs.profile.content_settings.exceptions[type][origin] = { setting: 1 };
      });
    });

    fs.writeFileSync(prefPath, JSON.stringify(prefs, null, 2), 'utf8');
    console.log(`[ProcessManager] Đã tự động cấu hình Tiện ích (Extension) & Quyền cho Facebook trong profile ${profileDir}`);
  } catch (err) {
    console.error('[ProcessManager] Lỗi tự động ghi quyền Preferences Chrome:', err.message);
  }
}

class ProcessManager {
  constructor() {
    this.processes = new Map(); // Key: account_id -> { process, profileDir }
    this.extensionPath = resolveExtensionPath();
    this.binChromePath = path.join(resolveBinRoot(), 'bin', 'chrome-win', 'chrome.exe');
  }

  // Khởi chạy Chrome Portable ngầm cho tài khoản FB
  startAccountProcess(accountId, customProfileDir = null) {
    if (this.processes.has(accountId)) {
      const existing = this.processes.get(accountId);
      const isAlive = existing.process && !existing.process.killed && existing.pid &&
        (() => { try { process.kill(existing.pid, 0); return true; } catch { return false; } })();
      if (isAlive) {
        console.log(`[ProcessManager] Tài khoản ${accountId} đã đang chạy (PID ${existing.pid}).`);
        return true;
      } else {
        console.log(`[ProcessManager] Phát hiện entry cũ của ${accountId} đã chết (PID ${existing.pid}). Xóa để khởi động lại.`);
        this.processes.delete(accountId);
      }
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
      profileDir = path.join(APP_DATA_ROOT, `profiles/${accountId}`);
    }

    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }
    ensureProfilePermissions(profileDir);

    const chromeExecutable = resolveChromePath({ repoRoot: resolveBinRoot(), legacyBinChromePath: this.binChromePath });
    const absExtPath = path.resolve(this.extensionPath).replace(/\\/g, '/');
    const absProfileDir = path.resolve(profileDir).replace(/\\/g, '/');

    const args = [
      `--user-data-dir=${absProfileDir}`,
      `--load-extension=${absExtPath}`,
      `--disable-extensions-except=${absExtPath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--use-fake-ui-for-media-stream',
      '--disable-popup-blocking',
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
      '--remote-debugging-port=0',
      'https://www.facebook.com/messages'
    ];

    console.log(`[ProcessManager] Khởi chạy Chrome Portable cho account ${accountId} (Profile: ${absProfileDir})...`);
    try {
      const child = spawn(chromeExecutable, args, {
        detached: true,
        stdio: 'ignore'
      });

      child.unref();

      child.on('error', (err) => {
        console.error(`[ProcessManager] Lỗi tiến trình Chrome account ${accountId}:`, err.message);
        if (this.processes.get(accountId)?.pid === child.pid) {
          this.processes.delete(accountId);
        }
      });

      child.on('exit', (code) => {
        const entry = this.processes.get(accountId);
        if (entry && entry.pid === child.pid) {
          console.log(`[ProcessManager] Chrome [PID ${child.pid}] cho account ${accountId} đã tắt (code=${code}). Xóa khỏi danh sách.`);
          this.processes.delete(accountId);
        }
      });

      this.processes.set(accountId, {
        process: child,
        profileDir: absProfileDir,
        pid: child.pid,
        status: 'RUNNING'
      });

      // Tự động ẩn cửa sổ Chrome ngầm khỏi màn hình PC & Taskbar sau khi bật
      hideFromTaskbar(child.pid, 2000);
      hideFromTaskbar(child.pid, 5000);

      console.log(`[ProcessManager] Chrome Portable [PID ${child.pid}] khởi chạy thành công và đã tự động chạy ngầm.`);
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

    const profileDir = path.join(APP_DATA_ROOT, `profiles/${pendingKey}`);
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }
    ensureProfilePermissions(profileDir);

    const chromeExecutable = resolveChromePath({ repoRoot: resolveBinRoot(), legacyBinChromePath: this.binChromePath });
    const absExtPath = path.resolve(this.extensionPath).replace(/\\/g, '/');
    const absProfileDir = path.resolve(profileDir).replace(/\\/g, '/');

    const args = [
      `--user-data-dir=${absProfileDir}`,
      `--load-extension=${absExtPath}`,
      `--disable-extensions-except=${absExtPath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--use-fake-ui-for-media-stream',
      '--disable-popup-blocking',
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
      '--remote-debugging-port=0',
      '--enable-background-networking',
      `https://www.facebook.com/messages?crm_pending_key=${pendingKey}`
    ];

    console.log(`[ProcessManager] Khởi chạy Chrome mới cho phiên thêm account [${pendingKey}]...`);
    try {
      const child = spawn(chromeExecutable, args, {
        detached: true,
        stdio: 'ignore'
      });

      child.unref();

      child.on('error', (err) => {
        console.error(`[ProcessManager] Lỗi tiến trình Chrome phiên pending ${pendingKey}:`, err.message);
        if (this.processes.get(pendingKey)?.pid === child.pid) {
          this.processes.delete(pendingKey);
        }
      });

      child.on('exit', (code) => {
        const entry = this.processes.get(pendingKey);
        if (entry && entry.pid === child.pid) {
          console.log(`[ProcessManager] Chrome pending [PID ${child.pid}] cho ${pendingKey} đã đóng (code=${code}).`);
          this.processes.delete(pendingKey);
        }
      });

      this.processes.set(pendingKey, {
        process: child,
        profileDir,
        pid: child.pid,
        status: 'RUNNING'
      });

      console.log(`[ProcessManager] Chrome pending session [PID ${child.pid}] khởi chạy thành công (cửa sổ mở để người dùng đăng nhập).`);
      return true;
    } catch (err) {
      console.error(`[ProcessManager] Lỗi khởi chạy Chrome cho phiên ${pendingKey}:`, err.message);
      return false;
    }
  }

  // Tự động ẩn cửa sổ Chrome ngầm khỏi Taskbar khi vừa hoàn tất đăng ký
  hideAccountProcess(accountId) {
    const procInfo = this.processes.get(accountId);
    if (procInfo && procInfo.pid) {
      hideFromTaskbar(procInfo.pid, 500);
      hideFromTaskbar(procInfo.pid, 2500);
      console.log(`[ProcessManager] Tự động ẩn Chrome của account ${accountId} khỏi Taskbar.`);
      return true;
    }
    return false;
  }

  // Bật sáng cửa sổ Chrome GUI khi gặp Checkpoint / OTP 2FA / Session Expired / Cuộc gọi
  unhideWindow(accountId) {
    console.log(`[ProcessManager] Bật sáng cửa sổ Chrome cho account ${accountId}!`);
    const procInfo = this.processes.get(accountId);
    const pid = procInfo?.pid;

    if (process.platform === 'win32') {
      const psScript = pid
        ? `$app = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($app -and $app.MainWindowHandle -ne 0) { try { Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32Helper { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int m); }' } catch {}; [Win32Helper]::ShowWindowAsync($app.MainWindowHandle, 9); [Win32Helper]::SetForegroundWindow($app.MainWindowHandle); }`
        : `$apps = Get-Process -Name 'chrome' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }; if ($apps) { try { Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32Helper { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int m); }' } catch {}; foreach ($a in $apps) { [Win32Helper]::ShowWindowAsync($a.MainWindowHandle, 9); [Win32Helper]::SetForegroundWindow($a.MainWindowHandle); } }`;

      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, (err) => {
        if (err) console.error('[ProcessManager] Lỗi đưa cửa sổ Chrome lên foreground:', err.message);
      });
    } else {
      console.log(`[ProcessManager] (Linux/macOS) Vui lòng kiểm tra cửa sổ Chrome PID ${pid || 'unknown'}`);
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
