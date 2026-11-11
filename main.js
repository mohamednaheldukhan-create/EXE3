const { app, BrowserWindow, protocol, net, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

// ---- التفعيل: يُخزَّن الهاش فقط وليس كلمة السر نفسها ----
const SALT = 'dukhan-clinic-v1';
const sha = (s) => crypto.createHash('sha256').update(SALT + String(s).trim()).digest('hex');
// SHA-256( SALT + "45531324" )
const CODE_HASH = sha('45531324');
const LICENSE_FILE = () => path.join(app.getPath('userData'), 'license.json');

function safeEqual(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function isActivated() {
  try {
    const j = JSON.parse(fs.readFileSync(LICENSE_FILE(), 'utf8'));
    return typeof j.h === 'string' && safeEqual(j.h, CODE_HASH);
  } catch { return false; }
}

// ---- بروتوكول app:// لتشغيل التطبيق بأصل ثابت (يحفظ البيانات بشكل دائم) ----
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

const APP_DIR = path.join(__dirname, 'app');
let win;

function createMainWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: 'نظام إدارة العيادة',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadURL('app://clinic/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

function createActivationWindow() {
  const w = new BrowserWindow({
    width: 460, height: 420, resizable: false, maximizable: false,
    title: 'تفعيل البرنامج', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  w.loadFile(path.join(__dirname, 'activation.html'));
  ipcMain.removeHandler('license:activate');
  ipcMain.handle('license:activate', (_e, code) => {
    const toLatin = String(code || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const h = sha(toLatin);
    if (!safeEqual(h, CODE_HASH)) return { ok: false };
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(LICENSE_FILE(), JSON.stringify({ h, at: new Date().toISOString() }));
    setTimeout(() => { w.close(); createMainWindow(); }, 400);
    return { ok: true };
  });
  ipcMain.once('license:quit', () => app.quit());
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(APP_DIR, rel));
    if (!file.startsWith(APP_DIR)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  Menu.setApplicationMenu(null);
  isActivated() ? createMainWindow() : createActivationWindow();
});

app.on('window-all-closed', () => app.quit());
