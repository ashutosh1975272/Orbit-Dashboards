import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LogCategory, LogEntry, LogLevel } from '../../../../shared/ipc-contract'

function formatRelativeTime(isoString: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000))
  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr}h ago`
}

export function LogsObservabilityTab(): React.JSX.Element {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<LogCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [retentionMinutes, setRetentionMinutes] = useState<number>(15)
  const [autoScroll, setAutoScroll] = useState(true)
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({})
  const [exportNotice, setExportNotice] = useState<string | null>(null)

  const streamEndRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Load initial logs
  const refreshLogs = useCallback(async () => {
    try {
      const recent = await window.api.logs.getRecent()
      setLogs(recent || [])
    } catch (err) {
      console.error('Failed to load logs', err)
    }
  }, [])

  useEffect(() => {
    void refreshLogs()
  }, [refreshLogs])

  // Real-time live log subscription
  useEffect(() => {
    const unsubscribe = window.api.logs.onLogEntry((entry: LogEntry) => {
      setLogs((prev) => {
        // Enforce 15m (or current retention) client-side cutoff as well
        const cutoff = retentionMinutes > 0 ? Date.now() - retentionMinutes * 60 * 1000 : 0
        const filtered = cutoff > 0 ? prev.filter((e) => new Date(e.ts).getTime() >= cutoff) : prev
        return [...filtered, entry]
      })
    })
    return () => unsubscribe()
  }, [retentionMinutes])

  // Periodic sweeper & relative timer updater every 5s
  useEffect(() => {
    const timer = setInterval(() => {
      if (retentionMinutes > 0) {
        const cutoff = Date.now() - retentionMinutes * 60 * 1000
        setLogs((prev) => prev.filter((e) => new Date(e.ts).getTime() >= cutoff))
      } else {
        // Trigger a force re-render for relative timestamps
        setLogs((prev) => [...prev])
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [retentionMinutes])

  // Auto-scroll when new logs arrive and autoScroll is active
  useEffect(() => {
    if (autoScroll && streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs.length, autoScroll])

  const handleRetentionChange = async (minutes: number): Promise<void> => {
    setRetentionMinutes(minutes)
    try {
      await window.api.logs.setRetention(minutes)
      await refreshLogs()
    } catch (err) {
      console.error('Failed to set retention', err)
    }
  }

  const handleClearLogs = async (): Promise<void> => {
    try {
      await window.api.logs.clear()
      setLogs([])
    } catch (err) {
      console.error('Failed to clear logs', err)
    }
  }

  const handleExportLogs = async (): Promise<void> => {
    try {
      const res = await window.api.logs.export()
      if (res?.content) {
        const blob = new Blob([res.content], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `orbit-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.log`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        setExportNotice(`Exported ${res.count} logs to download!`)
        setTimeout(() => setExportNotice(null), 3500)
      }
    } catch (err) {
      console.error('Failed to export logs', err)
    }
  }

  const toggleExpand = (id: string): void => {
    setExpandedLogIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Filter logs for view
  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      if (levelFilter !== 'all' && entry.level !== levelFilter) return false
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const msgMatch = entry.message.toLowerCase().includes(q)
        const catMatch = entry.category.toLowerCase().includes(q)
        const metaMatch = entry.meta
          ? JSON.stringify(entry.meta).toLowerCase().includes(q)
          : false
        if (!msgMatch && !catMatch && !metaMatch) return false
      }
      return true
    })
  }, [logs, levelFilter, categoryFilter, searchQuery])

  const errorCount = useMemo(() => logs.filter((e) => e.level === 'error').length, [logs])
  const warnCount = useMemo(() => logs.filter((e) => e.level === 'warn').length, [logs])

  return (
    <div className="logs-hub-container">
      {/* Header & Status Summary */}
      <div className="logs-header-section">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>📜</span> Application Observability & Logs
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              End-to-end real-time diagnostics, background sync telemetry, and security audit stream.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
                errorCount > 0
                  ? 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${errorCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'}`}
              />
              {errorCount > 0 ? `${errorCount} Active Errors` : 'System Healthy'}
            </span>

            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60">
              {logs.length} Live Entries
            </span>
          </div>
        </div>

        {/* Status Pills Strip */}
        <div className="grid grid-cols-4 gap-2 mt-4 text-xs">
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 flex flex-col justify-between">
            <span className="text-slate-400">Total Tracked</span>
            <span className="text-base font-bold text-white mt-0.5">{logs.length}</span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 flex flex-col justify-between">
            <span className="text-slate-400">Errors & Warnings</span>
            <span
              className={`text-base font-bold mt-0.5 ${errorCount > 0 ? 'text-rose-400' : 'text-slate-200'}`}
            >
              {errorCount} err · {warnCount} warn
            </span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 flex flex-col justify-between">
            <span className="text-slate-400">Retention Policy</span>
            <span className="text-base font-bold text-indigo-300 mt-0.5">
              {retentionMinutes > 0 ? `${retentionMinutes} min auto-purge` : 'Session only'}
            </span>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 flex flex-col justify-between">
            <span className="text-slate-400">Security Redaction</span>
            <span className="text-base font-bold text-emerald-400 mt-0.5">Active (Strict)</span>
          </div>
        </div>
      </div>

      {/* Toolbar Controls */}
      <div className="logs-toolbar-strip flex flex-wrap items-center justify-between gap-2.5 mt-4 p-3 bg-slate-900/80 border border-slate-800/80 rounded-xl">
        {/* Left: Filters & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            aria-label="Filter by log level"
          >
            <option value="all">All Levels</option>
            <option value="error">Errors Only</option>
            <option value="warn">Warnings</option>
            <option value="info">Info</option>
            <option value="security">Security</option>
            <option value="debug">Debug</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            <option value="ui">UI Clicks & Modals [UI]</option>
            <option value="nav">Navigation [NAV]</option>
            <option value="ipc">IPC Bridge [IPC]</option>
            <option value="sync">Sync Engine [SYNC]</option>
            <option value="auth">Authentication [AUTH]</option>
            <option value="sec">Security Audit [SEC]</option>
            <option value="error">Errors [ERROR]</option>
            <option value="system">System [SYS]</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search logs & metadata…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-64 bg-slate-800/90 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Right: Retention & Actions */}
        <div className="flex items-center gap-2">
          {/* Retention Duration Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Expire after:</span>
            <select
              value={retentionMinutes}
              onChange={(e) => void handleRetentionChange(Number(e.target.value))}
              className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none"
              aria-label="Log retention duration"
            >
              <option value={5}>5 min</option>
              <option value={15}>15 min (Default)</option>
              <option value={30}>30 min</option>
              <option value={60}>1 hour</option>
              <option value={0}>Session only</option>
            </select>
          </div>

          {/* Auto-scroll Pause Toggle */}
          <button
            type="button"
            onClick={() => setAutoScroll((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              autoScroll
                ? 'bg-indigo-950/60 border-indigo-700/60 text-indigo-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title={autoScroll ? 'Click to pause auto-scroll' : 'Click to resume live auto-scroll'}
          >
            {autoScroll ? '● Live Stream' : '⏸ Paused'}
          </button>

          {/* Export Button */}
          <button
            type="button"
            onClick={() => void handleExportLogs()}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
          >
            Export
          </button>

          {/* Clear Button */}
          <button
            type="button"
            onClick={() => void handleClearLogs()}
            className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 rounded-lg text-xs font-medium transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="mt-2 px-3 py-1.5 bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs rounded-lg animate-fade-in flex items-center justify-between">
          <span>{exportNotice}</span>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-emerald-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Log Feed Stream */}
      <div
        ref={containerRef}
        className="logs-stream-viewport mt-3 bg-slate-950/90 border border-slate-800/90 rounded-xl p-2.5 font-mono text-xs overflow-y-auto max-h-[460px] min-h-[300px]"
      >
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 font-sans">
            <p className="text-sm">No log entries found matching criteria</p>
            <p className="text-xs text-slate-600 mt-1">
              Events will automatically appear here as user actions, sync tasks, or errors occur.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((entry) => {
              const isExpanded = Boolean(expandedLogIds[entry.id])
              const hasMeta = Boolean(
                entry.meta &&
                  typeof entry.meta === 'object' &&
                  Object.keys(entry.meta as Record<string, unknown>).length > 0
              )

              let levelColor = 'text-slate-300'
              let levelBadgeBg = 'bg-slate-800 text-slate-300 border-slate-700'
              if (entry.level === 'error') {
                levelColor = 'text-rose-400 font-semibold'
                levelBadgeBg = 'bg-rose-950/80 text-rose-300 border-rose-800'
              } else if (entry.level === 'warn') {
                levelColor = 'text-amber-300'
                levelBadgeBg = 'bg-amber-950/80 text-amber-300 border-amber-800'
              } else if (entry.level === 'security') {
                levelColor = 'text-purple-300 font-semibold'
                levelBadgeBg = 'bg-purple-950/80 text-purple-300 border-purple-800'
              }

              let categoryBadge = 'bg-slate-800 text-slate-400 border-slate-700'
              if (entry.category === 'ui')
                categoryBadge = 'bg-blue-950/70 text-blue-300 border-blue-800/60'
              if (entry.category === 'nav')
                categoryBadge = 'bg-purple-950/70 text-purple-300 border-purple-800/60'
              if (entry.category === 'sync')
                categoryBadge = 'bg-cyan-950/70 text-cyan-300 border-cyan-800/60'
              if (entry.category === 'ipc')
                categoryBadge = 'bg-teal-950/70 text-teal-300 border-teal-800/60'
              if (entry.category === 'auth')
                categoryBadge = 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
              if (entry.category === 'sec')
                categoryBadge = 'bg-amber-950/70 text-amber-300 border-amber-800/60'
              if (entry.category === 'error')
                categoryBadge = 'bg-rose-950/80 text-rose-300 border-rose-800/80'

              return (
                <div
                  key={entry.id}
                  className={`log-row p-2 rounded-lg border transition-colors ${
                    entry.level === 'error'
                      ? 'bg-rose-950/15 border-rose-900/30'
                      : 'bg-slate-900/40 border-slate-800/40 hover:bg-slate-900/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Timestamp */}
                      <span
                        className="text-slate-500 font-mono text-[11px] whitespace-nowrap"
                        title={entry.ts}
                      >
                        {formatRelativeTime(entry.ts)}
                      </span>

                      {/* Level Badge */}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${levelBadgeBg}`}
                      >
                        {entry.level}
                      </span>

                      {/* Category Badge */}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold border ${categoryBadge}`}
                      >
                        [{entry.category}]
                      </span>

                      {/* Log Message */}
                      <span className={`break-all ${levelColor}`}>{entry.message}</span>
                    </div>

                    {/* Metadata Toggle */}
                    {hasMeta ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(entry.id)}
                        className="px-1.5 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded border border-slate-700"
                      >
                        {isExpanded ? 'Hide Payload' : 'View Payload'}
                      </button>
                    ) : null}
                  </div>

                  {/* Expandable JSON Metadata */}
                  {hasMeta && isExpanded ? (
                    <div className="mt-2 p-2 bg-black/60 border border-slate-800 rounded font-mono text-[11px] text-slate-300 overflow-x-auto">
                      <pre>{JSON.stringify(entry.meta, null, 2)}</pre>
                    </div>
                  ) : null}
                </div>
              )
            })}
            <div ref={streamEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
