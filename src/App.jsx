import React, { useState, useCallback, useMemo, useRef } from 'react'

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

function App() {
  const [files, setFiles] = useState([])
  const [prefix, setPrefix] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState(null)
  const inputRef = useRef(null)

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
    try {
      const selected = await window.electronAPI.selectFiles()
      if (selected && selected.length > 0) {
        addFiles(selected)
      }
    } catch (err) {
      setStatus({ type: 'error', text: `选择文件失败: ${err.message}` })
    }
  }, [addFiles])

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
    if (files.length === 0) return
    setIsProcessing(true)
    setStatus({ type: 'info', text: '正在重命名...' })

    try {
      const filePaths = previewFiles.map(f => f.path)
      const results = await window.electronAPI.renameFiles(filePaths, prefix)

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
      setStatus({ type: 'error', text: `重命名失败: ${err.message}` })
    } finally {
      setIsProcessing(false)
    }
  }, [files, previewFiles, prefix])

  const handleOpenLog = useCallback(async () => {
    try {
      await window.electronAPI.openLogFile()
    } catch (err) {
      setStatus({ type: 'error', text: `打开日志失败: ${err.message}` })
    }
  }, [])

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
