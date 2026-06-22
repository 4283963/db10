const { app, BrowserWindow, ipcMain, dialog, shell, Notification } = require('electron')
const fs = require('fs')
const path = require('path')

let mainWindow = null

function sendNotification(title, body) {
  if (!Notification.isSupported()) {
    console.log('[main] 当前系统不支持通知')
    return
  }
  const notification = new Notification({
    title,
    body,
    silent: false
  })
  notification.show()
  console.log('[main] 已发送系统通知:', title, '-', body)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

function getLogFilePath() {
  const logDir = app.getPath('userData')
  return path.join(logDir, 'rename-log.txt')
}

function appendLog(line) {
  const logPath = getLogFilePath()
  const timestamp = new Date().toLocaleString('zh-CN', { hour12: false })
  const content = `[${timestamp}] ${line}\n`
  fs.appendFileSync(logPath, content, 'utf-8')
}

ipcMain.handle('dialog:selectFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择视频文件',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '视频文件', extensions: ['mp4', 'MP4', 'mov', 'MOV', 'mkv', 'MKV', 'avi', 'AVI'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (result.canceled) return []
  return result.filePaths
})

ipcMain.handle('files:rename', async (_event, files, prefix) => {
  const results = []
  const safePrefix = (prefix || '').trim()

  for (const filePath of files) {
    try {
      const dir = path.dirname(filePath)
      const ext = path.extname(filePath)
      const originalName = path.basename(filePath, ext)

      let newName
      if (safePrefix) {
        newName = `${safePrefix}_${originalName}${ext}`
      } else {
        newName = `${originalName}${ext}`
      }

      let newPath = path.join(dir, newName)
      let counter = 1
      while (fs.existsSync(newPath) && newPath !== filePath) {
        newName = safePrefix
          ? `${safePrefix}_${originalName}_${counter}${ext}`
          : `${originalName}_${counter}${ext}`
        newPath = path.join(dir, newName)
        counter++
      }

      if (newPath === filePath) {
        results.push({
          original: filePath,
          newPath: filePath,
          success: true,
          skipped: true,
          message: '文件名未变化，已跳过'
        })
        continue
      }

      fs.renameSync(filePath, newPath)
      appendLog(`重命名成功: ${filePath}  ->  ${newPath}`)
      results.push({
        original: filePath,
        newPath,
        success: true,
        skipped: false,
        message: '重命名成功'
      })
    } catch (err) {
      appendLog(`重命名失败: ${filePath}  错误: ${err.message}`)
      results.push({
        original: filePath,
        newPath: filePath,
        success: false,
        skipped: false,
        message: err.message || '未知错误'
      })
    }
  }

  const total = results.length
  const successCount = results.filter(r => r.success && !r.skipped).length
  const skippedCount = results.filter(r => r.skipped).length
  const failCount = results.filter(r => !r.success).length

  let title, body
  if (failCount > 0) {
    title = '批量重命名部分失败'
    body = `共处理 ${total} 个文件，成功 ${successCount} 个，跳过 ${skippedCount} 个，失败 ${failCount} 个`
  } else if (successCount === 0 && skippedCount > 0) {
    title = '批量重命名已完成'
    body = `共处理 ${total} 个文件，全部跳过（文件名未变化）`
  } else {
    title = '批量重命名已完成'
    body = `共处理 ${total} 个文件，成功 ${successCount} 个${skippedCount > 0 ? `，跳过 ${skippedCount} 个` : ''}`
  }

  sendNotification(title, body)

  return results
})

ipcMain.handle('log:open', async () => {
  const logPath = getLogFilePath()
  if (!fs.existsSync(logPath)) {
    fs.writeFileSync(logPath, '', 'utf-8')
  }
  shell.showItemInFolder(logPath)
  return logPath
})

app.whenReady().then(() => {
  createWindow()
  appendLog('应用启动')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
