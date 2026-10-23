const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const d = require('../src/detect');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-'));
let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log('ok', name); }
  catch (e) { fail++; console.log(`::error title=${name}::${String(e.message).replace(/\r?\n/g, ' | ')}`); }
};

t('linux: nothing installed returns null or a system install', () => {
  const r = d.detectLinux(tmp);
  assert(r === null || r.path.startsWith('/'));
});

t('linux: finds ~/.local/bin/claude-desktop', () => {
  const bin = path.join(tmp, '.local/bin/claude-desktop');
  fs.mkdirSync(path.dirname(bin), { recursive: true });
  fs.writeFileSync(bin, '#!/bin/sh\n'); fs.chmodSync(bin, 0o755);
  const r = d.detectLinux(tmp);
  assert.strictEqual(r.path, bin); assert.strictEqual(r.kind, 'exe');
  fs.rmSync(bin);
});

t('linux: finds a Claude AppImage in ~/Downloads', () => {
  const img = path.join(tmp, 'Downloads/Claude-1.2.3-x86_64.AppImage');
  fs.mkdirSync(path.dirname(img), { recursive: true });
  fs.writeFileSync(img, '');
  const r = d.detectLinux(tmp);
  assert.strictEqual(r.path, img); assert.strictEqual(r.source, 'AppImage');
});

t('windows: Squirrel picks the newest version folder', () => {
  const root = path.join(tmp, 'AnthropicClaude');
  for (const v of ['app-0.9.3', 'app-0.10.1', 'app-0.10.0']) {
    fs.mkdirSync(path.join(root, v), { recursive: true });
    fs.writeFileSync(path.join(root, v, 'claude.exe'), '');
  }
  assert.strictEqual(d.newestSquirrel(root), path.join(root, 'app-0.10.1', 'claude.exe'));
});

t('windows: candidate list covers per-user and machine-wide installs', () => {
  const c = d.candidatesWin({ LOCALAPPDATA: 'L', ProgramFiles: 'P', 'ProgramFiles(x86)': 'X' });
  assert(c.includes(path.join('L', 'AnthropicClaude', 'claude.exe')));
  assert(c.includes(path.join('P', 'Claude', 'Claude.exe')));
  assert(c.includes(path.join('X', 'Claude', 'Claude.exe')));
});

t('mac: candidate list covers system and user Applications', () => {
  const c = d.candidatesMac('/Users/x');
  assert(c.includes('/Applications/Claude.app'));
  assert(c.includes('/Users/x/Applications/Claude.app'));
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
