import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'

function getExtname(p) {
  const idx = p.lastIndexOf('.')
  return idx > 0 ? p.slice(idx) : ''
}

function getBasename(p, ext) {
  const sep = p.includes('\\') ? '\\' : '/'
  const idx = p.lastIndexOf(sep)
  const name = idx >= 0 ? p.slice(idx + 1) : p
  if (ext && name.endsWith(ext)) {
    return name.slice(0, name.length - ext.length)
  }
  return name
}

function getDirname(p) {
  const sep = p.includes('\\') ? '\\' : '/'
  const idx = p.lastIndexOf(sep)
  return idx > 0 ? p.slice(0, idx) : p
}

function getElectronAPI() {
  if (typeof window === 'undefined') return null
  return window.electronAPI || null
}

function isElectronEnv() {
  const api = getElectronAPI()
  return !!(api && api.isElectron)
}

function EnvAlert() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#fef2f2',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      zIndex: 9999
    }}>
      <div style={{
        maxWidth: 520,
        background: '#fff',
        padding: 32,
        borderRadius: 16,
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        border: '1px solid #fee2e2'
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#b91c1c', marginBottom: 12 }}>
          请通过 Electron 启动应用
        </h2>
        <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, marginBottom: 12 }}>
          当前检测到 <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 13 }}>window.electronAPI</code> 不存在。
          这说明你是在普通浏览器中打开，而 preload 脚本只在 Electron 窗口中才会注入。
        </p>
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7, marginBottom: 20 }}>
          <div style={{ marginBottom: 6, fontWeight: 500, color: '#374151' }}>正确的启动方式：</div>
          <div style={{
            background: '#1f2937',
            color: '#e5e7eb',
            padding: 12,
            borderRadius: 8,
            fontFamily: 'Menlo, monospace',
            fontSize: 12.5
          }}>
            cd /Users/kl/Documents/trae_projects2/db10<br/>
            npm start
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          提示：<code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>npm start</code> 会同时启动 Vite + Electron 窗口
        </div>
      </div>
    </div>
  )
}

function App() {
  const [envChecked, setEnvChecked] = useState(false)
  const [electronReady, setElectronReady] = useState(false)
  const [files, setFiles] = useState([])
  const [prefix, setPrefix] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => {
      const ready = isElectronEnv()
      setElectronReady(ready)
      setEnvChecked(true)
      if (ready) {
        console.log('[App] ✅ Electron API 检测通过，接口列表:', Object.keys(getElectronAPI()))
      } else {
        console.error('[App] ❌ 未检测到 window.electronAPI，请通过 Electron 启动')
        console.log('[App]   window.electronAPI =', window.electronAPI)
      }
    }, 100)
    return () => clearTimeout(t)
  }, [])

  const api = getElectronAPI()

  const previewFiles = useMemo(() => {
    if (!prefix.trim()) {
      return files.map(f => ({ ...f, newName: f.name }))
    }
    return files.map(f => {
      const ext = getExtname(f.name)
      const base = getBasename(f.name, ext)
      return { ...f, newName: `${prefix.trim()}_${base}${ext}` }
    })
  }, [files, prefix])

  const addFiles = useCallback((filePaths) => {
    const validExts = ['.mp4', '.mov', '.mkv', '.avi']
    const newFiles = []
    const existingPaths = new Set(files.map(f => f.path))

    for (const p of filePaths) {
      if (existingPaths.has(p)) continue
      const ext = getExtname(p).toLowerCase()
      if (!validExts.includes(ext)) continue
      newFiles.push({
        id: `${p}-${Date.now()}-${Math.random()}`,
        path: p,
        name: getBasename(p),
        dir: getDirname(p)
      })
    }

    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles])
      setStatus({ type: 'info', text: `已添加 ${newFiles.length} 个视频文件` })
    }
  }, [files])

  const handleSelectFiles = useCallback(async () => {
    if (!api) return
    try {
      const selected = await api.selectFiles()
      if (selected && selected.length > 0) {
        addFiles(selected)
      }
    } catch (err) {
      setStatus({ type: 'error', text: `选择文件失败: ${err.message}` })
    }
  }, [api, addFiles])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedPaths = []
    for (const file of e.dataTransfer.files) {
      if (file.path) droppedPaths.push(file.path)
    }
    if (droppedPaths.length > 0) {
      addFiles(droppedPaths)
    }
  }, [addFiles])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const removeFile = useCallback((id) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setFiles([])
    setStatus(null)
  }, [])

  const handleRename = useCallback(async () => {
    if (!api || files.length === 0) return
    setIsProcessing(true)
    setStatus({ type: 'info', text: '正在重命名...' })

    try {
      const filePaths = previewFiles.map(f => f.path)
      console.log('[App] 发起重命名请求, 文件路径:', filePaths, '前缀:', prefix)
      const results = await api.renameFiles(filePaths, prefix)
      console.log('[App] 主进程返回结果:', results)

      const successCount = results.filter(r => r.success && !r.skipped).length
      const skippedCount = results.filter(r => r.skipped).length
      const failCount = results.filter(r => !r.success).length

      const updatedFiles = files.map((f, idx) => {
        const result = results[idx]
        if (result && result.success && !result.skipped) {
          return {
            ...f,
            path: result.newPath,
            name: getBasename(result.newPath),
            dir: getDirname(result.newPath)
          }
        }
        return f
      })

      setFiles(updatedFiles.filter((f, idx) => {
        const result = results[idx]
        return result && !(!result.success && !result.skipped)
      }))

      let msg = `完成：成功 ${successCount} 个`
      if (skippedCount > 0) msg += `，跳过 ${skippedCount} 个`
      if (failCount > 0) msg += `，失败 ${failCount} 个`

      setStatus({
        type: failCount > 0 ? 'error' : 'success',
        text: msg
      })
    } catch (err) {
      console.error('[App] 重命名异常:', err)
      setStatus({ type: 'error', text: `重命名失败: ${err.message}` })
    } finally {
      setIsProcessing(false)
    }
  }, [api, files, previewFiles, prefix])

  const handleOpenLog = useCallback(async () => {
    if (!api) return
    try {
      await api.openLogFile()
    } catch (err) {
      setStatus({ type: 'error', text: `打开日志失败: ${err.message}` })
    }
  }, [api])

  if (!envChecked) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
        正在检测 Electron 环境...
      </div>
    )
  }

  if (!electronReady) {
    return <EnvAlert />
  }

  return (
    <div className="app">
      <div className="header">
        <h1>🎬 视频素材批量重命名工具</h1>
        <div className="header-actions">
          <button className="btn" onClick={handleOpenLog}>📄 查看日志</button>
        </div>
      </div>

      <div className="panel">
        <div className="input-group">
          <label>文件名前缀</label>
          <input
            ref={inputRef}
            type="text"
            placeholder="例如：vlog_2026  (留空则不添加前缀)"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            disabled={isProcessing}
          />
        </div>
        <button className="btn" onClick={handleSelectFiles} disabled={isProcessing}>
          📁 选择文件
        </button>
        <button
          className="btn-primary btn"
          onClick={handleRename}
          disabled={files.length === 0 || isProcessing}
        >
          {isProcessing ? '处理中...' : `✓ 批量重命名 (${files.length})`}
        </button>
        {files.length > 0 && (
          <button className="btn-danger btn" onClick={clearAll} disabled={isProcessing}>
            清空列表
          </button>
        )}
        <span className="preview-hint">
          {prefix.trim() && files.length > 0
            ? `预览: ${files[0].name} → ${prefix.trim()}_${files[0].name}`
            : ''}
        </span>
      </div>

      <div
        className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {files.length === 0 ? (
          <div className="drop-empty">
            <div className="drop-empty-icon">🎥</div>
            <div className="drop-empty-text">把 MP4 视频文件拖到这里</div>
            <div className="drop-empty-sub">或点击上方「选择文件」按钮</div>
          </div>
        ) : (
          <div className="file-list-wrap">
            <div className="file-list-header">
              <span className="file-count">共 {files.length} 个文件</span>
            </div>
            <div className="file-list">
              {previewFiles.map((f) => (
                <div key={f.id} className="file-item">
                  <div className="file-icon">🎞️</div>
                  <div className="file-info">
                    <div className="file-name">{f.name}</div>
                    {f.newName !== f.name && (
                      <div className="file-new-name">→ {f.newName}</div>
                    )}
                    <div className="file-path">{f.dir}</div>
                  </div>
                  <button
                    className="file-remove"
                    onClick={() => removeFile(f.id)}
                    disabled={isProcessing}
                    title="移除"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {status && (
        <div className="status-bar">
          <span className={`status-${status.type}`}>
            {status.type === 'success' && '✓ '}
            {status.type === 'error' && '✗ '}
            {status.type === 'info' && 'ℹ '}
            {status.text}
          </span>
        </div>
      )}
    </div>
  )
}

export default App
