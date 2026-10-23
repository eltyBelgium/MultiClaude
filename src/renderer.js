const $ = (id) => document.getElementById(id);
let state = null;

function msg(text, err = false) {
  $('msg').textContent = text || '';
  $('msg').className = 'msg' + (err ? ' err' : '');
}

// Turn a keydown event into an Electron accelerator, e.g. "CommandOrControl+Alt+1".
function toAccelerator(e) {
  const k = e.key;
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(k)) return null;
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (!parts.length) return null;
  const key = k.length === 1 ? k.toUpperCase() : k === ' ' ? 'Space' : k;
  parts.push(key);
  return parts.join('+');
}

function hotkeyCapture(input, onSet) {
  input.addEventListener('keydown', (e) => {
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Delete') { input.value = ''; onSet && onSet(''); return; }
    const acc = toAccelerator(e);
    if (acc) { input.value = acc; onSet && onSet(acc); }
  });
}

function reportFailed(r) {
  if (r && r.failed && r.failed.length) msg(`Hotkey in use by another app: ${r.failed.join(', ')}`, true);
}

function render() {
  const list = $('list');
  list.innerHTML = '';
  $('empty').hidden = state.profiles.length > 0;
  for (const p of state.profiles) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="bar"></div>
      <div>
        <div class="name"></div>
        <div class="meta"></div>
      </div>
      <div class="actions">
        <button data-a="launch">Open</button>
        <button data-a="code" class="ghost">Code</button>
        <button data-a="folder" class="ghost">Folder</button>
        <button data-a="remove" class="danger">Remove</button>
      </div>`;
    li.querySelector('.bar').style.background = p.color;
    li.querySelector('.name').textContent = p.name;
    li.querySelector('.meta').textContent = p.hotkey ? `Hotkey ${p.hotkey}` : 'No hotkey';
    li.querySelector('.actions').addEventListener('click', async (e) => {
      const a = e.target.dataset.a;
      if (!a) return;
      if (a === 'launch') { const r = await api.launch(p.name); msg(r.ok ? `Opened ${p.name}` : r.error, !r.ok); }
      if (a === 'code') { await api.code(p.name); msg(`Terminal opened for ${p.name}`); }
      if (a === 'folder') api.folder(p.name);
      if (a === 'remove') {
        await api.remove(p.name);
        msg(`Removed ${p.name}. Its data folder is kept, so re-adding the same name restores the login.`);
        load();
      }
    });
    list.appendChild(li);
  }
}

async function load() {
  state = await api.state();
  const c = state.claude;
  $('claudePath').textContent = c
    ? `${c.path || c.appId}  (${c.source}${c.kind === 'msix' ? ', ' + c.appId : ''})`
    : 'Not found in the default locations. Click Change to select Claude.';
  $('root').textContent = state.root;
  $('startAtLogin').checked = !!state.settings.startAtLogin;
  if (!c) $('settings').hidden = false;
  render();
}

$('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const r = await api.add({ name: $('name').value.trim(), color: $('color').value, hotkey: $('hotkey').value });
  if (!r.ok) return msg(r.error, true);
  msg(`Added ${$('name').value.trim()}. Click Open and log in once.`);
  reportFailed(r);
  $('name').value = '';
  $('hotkey').value = '';
  load();
});

hotkeyCapture($('hotkey'));
$('settingsBtn').addEventListener('click', () => {
  $('settings').hidden = !$('settings').hidden;
  $('supportPanel').hidden = true;
});
$('supportBtn').addEventListener('click', () => {
  $('supportPanel').hidden = !$('supportPanel').hidden;
  $('settings').hidden = true;
});
$('supportPanel').addEventListener('click', (e) => {
  const kind = e.target.dataset.s;
  if (kind) api.support(kind);
});
api.supportLinks().then((s) => {
  $('emailBtn').textContent = `Email ${s.email}`;
  $('donateBtn').hidden = !s.donate;
  $('versionLine').textContent = `MultiClaude ${s.version}. Independent tool, not affiliated with Anthropic.`;
});
$('pickClaude').addEventListener('click', async () => { const r = await api.pickClaude(); if (r.ok) load(); });
$('redetect').addEventListener('click', async () => {
  $('claudePath').textContent = 'Searching…';
  const c = await api.redetect();
  msg(c ? `Found Claude Desktop (${c.source}).` : 'Claude Desktop not found in the default locations.', !c);
  load();
});
$('startAtLogin').addEventListener('change', (e) => api.startAtLogin(e.target.checked));

load();
