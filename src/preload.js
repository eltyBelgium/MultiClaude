const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  state: () => ipcRenderer.invoke('state'),
  add: (p) => ipcRenderer.invoke('profile:add', p),
  update: (p) => ipcRenderer.invoke('profile:update', p),
  remove: (name) => ipcRenderer.invoke('profile:remove', name),
  launch: (name) => ipcRenderer.invoke('profile:launch', name),
  code: (name) => ipcRenderer.invoke('profile:code', name),
  folder: (name) => ipcRenderer.invoke('profile:folder', name),
  pickClaude: () => ipcRenderer.invoke('settings:pickClaude'),
  redetect: () => ipcRenderer.invoke('settings:redetect'),
  supportLinks: () => ipcRenderer.invoke('support:links'),
  support: (kind) => ipcRenderer.invoke('support:open', kind),
  startAtLogin: (on) => ipcRenderer.invoke('settings:startAtLogin', on),
});
