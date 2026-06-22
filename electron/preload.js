const { contextBridge, ipcRenderer } = require('electron')

const CHANNELS = {
  SELECT_FILES: 'dialog:selectFiles',
  RENAME_FILES: 'files:rename',
  OPEN_LOG: 'log:open'
}

const electronAPI = {
  selectFiles: () => {
    console.log('[preload] 调用 selectFiles, 通道:', CHANNELS.SELECT_FILES)
    return ipcRenderer.invoke(CHANNELS.SELECT_FILES)
  },
  renameFiles: (files, prefix) => {
    console.log('[preload] 调用 renameFiles, 通道:', CHANNELS.RENAME_FILES, '文件数:', files?.length, '前缀:', prefix)
    return ipcRenderer.invoke(CHANNELS.RENAME_FILES, files, prefix)
  },
  openLogFile: () => {
    console.log('[preload] 调用 openLogFile, 通道:', CHANNELS.OPEN_LOG)
    return ipcRenderer.invoke(CHANNELS.OPEN_LOG)
  },
  isElectron: true
}

try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  console.log('[preload] ✅ electronAPI 已成功注入到 window 对象')
  console.log('[preload] 可用接口:', Object.keys(electronAPI))
} catch (err) {
  console.error('[preload] ❌ contextBridge 注入失败:', err)
}
