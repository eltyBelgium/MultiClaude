// Finds Claude Desktop in the default install locations on macOS, Windows and Linux.
// Returns { kind, path, appId?, source } or null.
//   kind 'mac-app'  -> /Applications/Claude.app, launched with `open -n -a`
//   kind 'exe'      -> a directly executable binary (Windows Squirrel/NSIS, Linux)
//   kind 'msix'     -> Microsoft Store / MSIX package, launched through its AppUserModelID
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function exists(p) {
  try { return !!p && fs.existsSync(p); } catch { return false; }
}

function run(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', timeout: 8000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], ...opts }).trim();
  } catch {
    return '';
  }
}

// Pick the newest Squirrel "app-x.y.z" folder that holds claude.exe.
function newestSquirrel(root) {
  try {
    const dirs = fs.readdirSync(root).filter((d) => /^app-\d/.test(d));
    dirs.sort((a, b) => {
      const pa = a.slice(4).split('.').map(Number);
      const pb = b.slice(4).split('.').map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
      }
      return 0;
    });
    for (const d of dirs) {
      const exe = path.join(root, d, 'claude.exe');
      if (exists(exe)) return exe;
    }
  } catch {}
  return null;
}

// ---------- macOS ----------
function candidatesMac(home) {
  return [
    '/Applications/Claude.app',
    path.join(home, 'Applications', 'Claude.app'),
    '/Applications/Setapp/Claude.app',
  ];
}

function detectMac(home = os.homedir()) {
  for (const p of candidatesMac(home)) {
    if (exists(p)) return { kind: 'mac-app', path: p, source: 'default location' };
  }
  // Spotlight fallback: finds Claude.app wherever it lives.
  const hit = run('mdfind', ['kMDItemCFBundleIdentifier == "com.anthropic.claudefordesktop"']).split('\n').find((l) => l.endsWith('.app'));
  if (hit && exists(hit)) return { kind: 'mac-app', path: hit, source: 'Spotlight' };
  return null;
}

// ---------- Windows ----------
function candidatesWin(env = process.env) {
  const local = env.LOCALAPPDATA || '';
  const pf = env.ProgramFiles || 'C:\\Program Files';
  const pf86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  return [
    path.join(local, 'AnthropicClaude', 'claude.exe'), // Squirrel stub, forwards arguments to the current version
    path.join(local, 'Programs', 'Claude', 'Claude.exe'),
    path.join(local, 'Programs', 'claude', 'claude.exe'),
    path.join(pf, 'Claude', 'Claude.exe'),
    path.join(pf, 'AnthropicClaude', 'claude.exe'),
    path.join(pf86, 'Claude', 'Claude.exe'),
  ];
}

function detectWin(env = process.env) {
  for (const p of candidatesWin(env)) {
    if (exists(p)) return { kind: 'exe', path: p, source: 'default location' };
  }
  const squirrel = newestSquirrel(path.join(env.LOCALAPPDATA || '', 'AnthropicClaude'));
  if (squirrel) return { kind: 'exe', path: squirrel, source: 'Squirrel version folder' };

  // MSIX / Microsoft Store install.
  const ps = [
    '$p = Get-AppxPackage -Name "*Claude*" | Where-Object { $_.Publisher -match "Anthropic" } | Select-Object -First 1;',
    'if (-not $p) { $p = Get-AppxPackage -Name "Claude*" | Select-Object -First 1 }',
    'if ($p) {',
    '  $id = (Get-AppxPackageManifest $p).Package.Applications.Application | Select-Object -First 1 -ExpandProperty Id;',
    '  $exe = Get-ChildItem $p.InstallLocation -Filter claude.exe -Recurse -Depth 3 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName;',
    '  [pscustomobject]@{ loc = $p.InstallLocation; aumid = "$($p.PackageFamilyName)!$id"; exe = $exe } | ConvertTo-Json -Compress',
    '}',
  ].join(' ');
  const out = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]);
  if (out) {
    try {
      const j = JSON.parse(out);
      if (j.aumid) return { kind: 'msix', path: j.exe || j.loc, appId: j.aumid, source: 'Microsoft Store / MSIX' };
    } catch {}
  }

  // Last resort: whatever "claude-desktop" or "Claude" resolves to on PATH.
  const where = run('where.exe', ['Claude.exe']).split(/\r?\n/)[0];
  if (where && exists(where)) return { kind: 'exe', path: where, source: 'PATH' };
  return null;
}

// ---------- Linux ----------
function candidatesLinux(home) {
  return [
    '/usr/bin/claude-desktop', // official apt package (beta)
    '/usr/local/bin/claude-desktop',
    '/opt/Claude/claude-desktop',
    '/opt/Claude/claude',
    '/opt/claude-desktop/claude-desktop',
    '/usr/lib/claude-desktop/claude-desktop',
    path.join(home, '.local', 'bin', 'claude-desktop'),
    path.join(home, 'Applications', 'Claude.AppImage'),
    path.join(home, 'Applications', 'claude-desktop.AppImage'),
  ];
}

function detectLinux(home = os.homedir()) {
  for (const p of candidatesLinux(home)) {
    if (exists(p)) return { kind: 'exe', path: p, source: 'default location' };
  }
  const which = run('sh', ['-c', 'command -v claude-desktop']);
  if (which && exists(which)) return { kind: 'exe', path: which, source: 'PATH' };
  // Any AppImage in ~/Applications or ~/Downloads whose name starts with "claude".
  for (const dir of [path.join(home, 'Applications'), path.join(home, 'Downloads')]) {
    try {
      const f = fs.readdirSync(dir).find((n) => /^claude.*\.appimage$/i.test(n));
      if (f) return { kind: 'exe', path: path.join(dir, f), source: 'AppImage' };
    } catch {}
  }
  return null;
}

function detect(platform = process.platform) {
  if (platform === 'darwin') return detectMac();
  if (platform === 'win32') return detectWin();
  if (platform === 'linux') return detectLinux();
  return null;
}

// Classify a path the user picked by hand.
function fromManual(p, platform = process.platform) {
  if (!exists(p)) return null;
  if (platform === 'darwin') return { kind: 'mac-app', path: p, source: 'set manually' };
  return { kind: 'exe', path: p, source: 'set manually' };
}

module.exports = { detect, fromManual, candidatesMac, candidatesWin, candidatesLinux, detectLinux, newestSquirrel };
