const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crmDesktop', {
  testConnection: (url) => ipcRenderer.invoke('connection:test', url),
  saveConnection: (url) => ipcRenderer.invoke('connection:save', url),
});
