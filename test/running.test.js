const assert = require('assert');
const { parse, toProcs } = require('../src/running');
let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log('ok', name); }
  catch (e) { fail++; console.log(`::error title=${name}::${String(e.message).replace(/\r?\n/g, ' | ')}`); }
};

t('mac: main process wins over helpers', () => {
  const procs = toProcs([
    '  501 /Applications/Claude.app/Contents/Frameworks/Claude Helper (Renderer).app/Contents/MacOS/Claude Helper (Renderer) --type=renderer --user-data-dir=/Users/tyas/ClaudeProfiles/elty/desktop',
    '  500 /Applications/Claude.app/Contents/MacOS/Claude --user-data-dir=/Users/tyas/ClaudeProfiles/elty/desktop',
    '  600 /Applications/Claude.app/Contents/MacOS/Claude',
  ].join('\n'), null);
  const r = parse(procs);
  assert.strictEqual(r.size, 1);
  assert.strictEqual(r.get('elty'), 500);
});

t('windows: quoted path with spaces', () => {
  const procs = toProcs([
    '4120\t"C:\\Users\\Tyas Z\\AppData\\Local\\AnthropicClaude\\app-1.2.3\\claude.exe" "--user-data-dir=C:\\Users\\Tyas Z\\ClaudeProfiles\\acom\\desktop"',
    '4130\t"C:\\...\\claude.exe" --type=gpu-process "--user-data-dir=C:\\Users\\Tyas Z\\ClaudeProfiles\\acom\\desktop"',
    '5000\t"C:\\...\\claude.exe" "--user-data-dir=C:\\Users\\Tyas Z\\ClaudeProfiles\\elty\\desktop"',
  ].join('\r\n'), '\t');
  const r = parse(procs);
  assert.deepStrictEqual([...r.entries()].sort(), [['acom', 4120], ['elty', 5000]]);
});

t('only helpers running still counts as running', () => {
  const r = parse([{ pid: 9, cmd: 'claude --type=renderer --user-data-dir=/h/ClaudeProfiles/x/desktop' }]);
  assert.strictEqual(r.get('x'), 9);
});

t('ignores unrelated processes and the default Claude instance', () => {
  const r = parse([{ pid: 1, cmd: 'Claude' }, { pid: 2, cmd: 'vim ClaudeProfiles/elty/desktop' }]);
  assert.strictEqual(r.size, 0);
});

t('pidsFor returns main process first, then helpers, only for that profile', () => {
  const procs = [
    { pid: 11, cmd: 'c --type=gpu-process --user-data-dir=/h/ClaudeProfiles/a/desktop' },
    { pid: 10, cmd: 'c --user-data-dir=/h/ClaudeProfiles/a/desktop' },
    { pid: 20, cmd: 'c --user-data-dir=/h/ClaudeProfiles/b/desktop' },
  ];
  assert.deepStrictEqual(require('../src/running').pidsFor(procs, 'a'), [10, 11]);
});

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
