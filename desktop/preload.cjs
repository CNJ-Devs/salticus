const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('salticus', {
  call: (method, args) => ipcRenderer.invoke('salticus', method, args),
  onStatus: listener => { ipcRenderer.on('status-changed', listener); },
});
