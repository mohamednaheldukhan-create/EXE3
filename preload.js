const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('licenseApi', {
  activate: (code) => ipcRenderer.invoke('license:activate', code),
  quit: () => ipcRenderer.send('license:quit'),
});
