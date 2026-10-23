// Claude Profiles: Electron tray app that runs isolated Claude Desktop instances.
const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, shell, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFile } = require('child_process');
const { detect, fromManual } = require('./detect');

const IS_MAC = process.platform === 'darwin';
const IS_WIN = process.platform === 'win32';
const PROFILE_ROOT = path.join(os.homedir(), 'ClaudeProfiles');
const STORE = () => path.join(app.getPath('userData'), 'profiles.json');
const NAME_RE = /^[A-Za-z0-9_-]{1,40}$/;

let win = null;
let tray = null;
let quitting = false;

// ---------- storage ----------
function loadStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE(), 'utf8'));
  } catch {
    return { profiles: [], settings: { claudePath: '', startAtLogin: false } };
  }
}
function saveStore(s) {
  fs.mkdirSync(path.dirname(STORE()), { recursive: true });
  fs.writeFileSync(STORE(), JSON.stringify(s, null, 2));
}
let store = null;

// ---------- Claude detection ----------
let detected; // cached result of the location search
function findClaude(force = false) {
  if (store.settings.claudePath) {
    const manual = fromManual(store.settings.claudePath);
    if (manual) return manual;
  }
  if (detected === undefined || force) detected = detect();
  return detected;
}

// MSIX apps cannot be started by file path. IApplicationActivationManager starts them by
// AppUserModelID and passes command-line arguments through.
const ACTIVATE_PS = `
$src = @'
using System; using System.Runtime.InteropServices;
[ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAAM {
  int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string id, [MarshalAs(UnmanagedType.LPWStr)] string args, int opts, out uint pid);
  int ActivateForFile(IntPtr a, IntPtr b, IntPtr c, out uint d);
  int ActivateForProtocol(IntPtr a, IntPtr b, out uint c);
}
[ComImport, Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")] class AAM {}
public static class Act { public static uint Run(string id, string a) { uint pid; int hr = ((IAAM)new AAM()).ActivateApplication(id, a, 0, out pid); if (hr != 0) Marshal.ThrowExceptionForHR(hr); return pid; } }
'@
Add-Type -TypeDefinition $src
[Act]::Run($env:CP_AUMID, $env:CP_ARGS)
`;

function activateMsix(appId, args) {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', ACTIVATE_PS],
      { windowsHide: true, env: { ...process.env, CP_AUMID: appId, CP_ARGS: args } },
      (err, stdout, stderr) => resolve(err ? { ok: false, error: (stderr || err.message).trim() } : { ok: true })
    );
  });
}

function spawnDetached(cmd, args) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    } catch (e) {
      return resolve({ ok: false, error: e.message });
    }
    child.once('error', (e) => resolve({ ok: false, error: e.message }));
    child.once('spawn', () => { child.unref(); resolve({ ok: true }); });
  });
}

// ---------- profile actions ----------
function dataDir(name, kind) {
  const d = path.join(PROFILE_ROOT, name, kind);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

async function launchDesktop(name) {
  const claude = findClaude();
  if (!claude) {
    dialog.showErrorBox('Claude not found', 'Claude Desktop was not found in the default locations. Set the path in Settings.');
    return { ok: false, error: 'Claude Desktop not found' };
  }
  const dir = dataDir(name, 'desktop');
  const arg = `--user-data-dir=${dir}`;

  if (claude.kind === 'mac-app') return spawnDetached('open', ['-n', '-a', claude.path, '--args', arg]);

  if (claude.kind === 'msix') {
    // Try the executable inside the package first, then fall back to activation by AppUserModelID.
    if (claude.path && claude.path.toLowerCase().endsWith('.exe')) {
      const r = await spawnDetached(claude.path, [arg]);
      if (r.ok) return r;
    }
    return activateMsix(claude.appId, `"${arg}"`);
  }

  // Linux: Electron apps need --no-sandbox only when run as root; skip otherwise.
  return spawnDetached(claude.path, [arg]);
}

const LINUX_TERMINALS = [
  ['x-terminal-emulator', ['-e']],
  ['gnome-terminal', ['--']],
  ['konsole', ['-e']],
  ['xfce4-terminal', ['-x']],
  ['kitty', []],
  ['alacritty', ['-e']],
  ['xterm', ['-e']],
];

function onPath(bin) {
  try {
    require('child_process').execFileSync('sh', ['-c', `command -v ${bin}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function openCodeTerminal(name) {
  const dir = dataDir(name, 'code');
  if (IS_MAC) {
    const cmd = `export CLAUDE_CONFIG_DIR='${dir}'; echo 'Claude Code profile: ${name}'; claude`;
    const script = `tell application "Terminal" to activate\ntell application "Terminal" to do script "${cmd.replace(/"/g, '\\"')}"`;
    execFile('osascript', ['-e', script]);
    return { ok: true };
  }
  if (IS_WIN) {
    const ps = `$env:CLAUDE_CONFIG_DIR='${dir}'; Write-Host 'Claude Code profile: ${name}'; claude`;
    const wt = spawn('wt.exe', ['powershell', '-NoExit', '-Command', ps], { detached: true, stdio: 'ignore' });
    wt.on('error', () =>
      spawn('cmd.exe', ['/c', 'start', 'powershell', '-NoExit', '-Command', ps], { detached: true, stdio: 'ignore' }).unref()
    );
    wt.unref();
    return { ok: true };
  }
  // Linux
  const sh = `export CLAUDE_CONFIG_DIR='${dir}'; echo 'Claude Code profile: ${name}'; claude; exec bash`;
  const term = LINUX_TERMINALS.find(([bin]) => onPath(bin));
  if (!term) return { ok: false, error: 'No terminal emulator found.' };
  spawn(term[0], [...term[1], 'bash', '-c', sh], { detached: true, stdio: 'ignore' }).unref();
  return { ok: true };
}

// ---------- hotkeys ----------
function registerHotkeys() {
  globalShortcut.unregisterAll();
  const failed = [];
  for (const p of store.profiles) {
    if (!p.hotkey) continue;
    try {
      if (!globalShortcut.register(p.hotkey, () => launchDesktop(p.name))) failed.push(p.hotkey);
    } catch {
      failed.push(p.hotkey);
    }
  }
  return failed;
}

// ---------- tray ----------
function buildTray() {
  const icon = IS_MAC
    ? nativeImage.createFromPath(path.join(__dirname, '../assets/trayTemplate.png'))
    : nativeImage.createFromPath(path.join(__dirname, '../assets/tray-win.png'));
  if (IS_MAC) icon.setTemplateImage(true);
  if (!tray) {
    tray = new Tray(icon);
    tray.setToolTip('Claude Profiles');
    tray.on('click', () => (IS_MAC ? null : showWindow()));
  }
  const items = store.profiles.map((p) => ({
    label: p.name + (p.hotkey ? `   ${p.hotkey}` : ''),
    submenu: [
      { label: 'Open Claude Desktop', click: () => launchDesktop(p.name) },
      { label: 'Open Claude Code terminal', click: () => openCodeTerminal(p.name) },
      { label: 'Show data folder', click: () => shell.openPath(path.join(PROFILE_ROOT, p.name)) },
    ],
  }));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      ...(items.length ? items : [{ label: 'No profiles yet', enabled: false }]),
      { type: 'separator' },
      { label: 'Manage profiles…', click: showWindow },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } },
    ])
  );
}

// ---------- window ----------
function showWindow() {
  if (win) { win.show(); win.focus(); return; }
  win = new BrowserWindow({
    width: 560,
    height: 640,
    minWidth: 460,
    title: 'Claude Profiles',
    backgroundColor: '#14141a',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });
  win.on('closed', () => (win = null));
}

function refresh() {
  saveStore(store);
  buildTray();
  return registerHotkeys();
}

// ---------- IPC ----------
ipcMain.handle('state', () => ({
  profiles: store.profiles,
  settings: store.settings,
  claude: findClaude(),
  root: PROFILE_ROOT,
  platform: process.platform,
}));

ipcMain.handle('settings:redetect', () => {
  store.settings.claudePath = '';
  saveStore(store);
  return findClaude(true);
});

ipcMain.handle('profile:add', (_e, { name, color, hotkey }) => {
  if (!NAME_RE.test(name || '')) return { ok: false, error: 'Use letters, digits, - or _ (max 40).' };
  if (store.profiles.some((p) => p.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'Profile exists.' };
  store.profiles.push({ name, color: color || '#d97757', hotkey: hotkey || '' });
  const failed = refresh();
  return { ok: true, failed };
});

ipcMain.handle('profile:update', (_e, { name, color, hotkey }) => {
  const p = store.profiles.find((x) => x.name === name);
  if (!p) return { ok: false, error: 'Not found.' };
  p.color = color ?? p.color;
  p.hotkey = hotkey ?? p.hotkey;
  const failed = refresh();
  return { ok: true, failed };
});

ipcMain.handle('profile:remove', (_e, name) => {
  // Removes the profile from the list only. The data folder stays, so the login can be recovered.
  store.profiles = store.profiles.filter((p) => p.name !== name);
  refresh();
  return { ok: true };
});

ipcMain.handle('profile:launch', (_e, name) => launchDesktop(name));
ipcMain.handle('profile:code', (_e, name) => openCodeTerminal(name));
ipcMain.handle('profile:folder', (_e, name) => shell.openPath(dataDir(name, 'desktop').replace(/[\\/]desktop$/, '')));

ipcMain.handle('settings:pickClaude', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile', ...(IS_MAC ? ['treatPackageAsDirectory'] : [])],
    filters: IS_WIN ? [{ name: 'Claude', extensions: ['exe'] }] : [],
    defaultPath: IS_MAC ? '/Applications' : process.env.LOCALAPPDATA,
  });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  let p = r.filePaths[0];
  if (IS_MAC) { const i = p.indexOf('.app'); if (i > -1) p = p.slice(0, i + 4); }
  store.settings.claudePath = p;
  saveStore(store);
  return { ok: true, claude: findClaude() };
});

ipcMain.handle('settings:startAtLogin', (_e, on) => {
  store.settings.startAtLogin = !!on;
  app.setLoginItemSettings({ openAtLogin: !!on, openAsHidden: true });
  saveStore(store);
  return { ok: true };
});

// ---------- lifecycle ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    store = loadStore();
    if (IS_MAC && app.dock) app.dock.hide();
    buildTray();
    registerHotkeys();
    if (!store.profiles.length) showWindow();
  });
  app.on('window-all-closed', (e) => e.preventDefault());
  app.on('before-quit', () => (quitting = true));
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
