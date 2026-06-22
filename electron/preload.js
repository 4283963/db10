const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  selectFiles: () => ipcRenderer.invoke('dialog:selectFiles'),
  renameFiles: (files, prefix) => ipcRenderer.invoke('files:rename', files, prefix),
  openLogFile: () => ipcRenderer.invoke('log:open')
})
