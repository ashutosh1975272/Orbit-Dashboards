import { useEffect, useState } from 'react'

export interface RunLogItem {
  runId: string
  ts: string
  trigger: 'scheduled' | 'manual'
  projectId: string
  sourceId: string
  sourceKind: 'token' | 'browser'
  workspaceId: string
  channelsRead: number
  newMessages: number
  snippets?: Array<{
    channelId: string
    channelName?: string
    sender: string
    ts: string
    snippet: string
  }>
  durationMs: number
  status: string
  error?: string
  errorCode?: string
}

interface RunLogsModalProps {
  open: boolean
  projectId: string
  projectName: string
  onClose: () => void
}

export function RunLogsModal({ open, projectId, projectName, onClose }: RunLogsModalProps): React.JSX.Element | null {
  const [logs, setLogs] = useState<RunLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(new Set())
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('all')

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const data = await window.api.dashboard.getRunLogs({ projectId })
      setLogs(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      void fetchLogs()
    }
  }, [open, projectId])

  const toggleRunExpand = (runId: string) => {
    setExpandedRunIds((prev) => {
      const next = new Set(prev)
      if (next.has(runId)) next.delete(runId)
      else next.add(runId)
      return next
    })
  }

  if (!open) return null

  const workspaces = Array.from(new Set(logs.map((l) => l.workspaceId).filter(Boolean)))
  const filteredLogs = selectedWorkspace === 'all' ? logs : logs.filter((l) => l.workspaceId === selectedWorkspace)

  return (
    <div
      className="platform-settings-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ zIndex: 1200 }}
    >
      <div
        className="platform-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Automation Scraping Logs"
        style={{
          maxWidth: '960px',
          width: '92%',
          height: '85vh',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)'
        }}
      >
        <header className="platform-settings-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 600 }}>Automation Scraping Run Logs</h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Project: <span style={{ color: '#38bdf8' }}>{projectName}</span> · Audit trail of message captures
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" className="btn ghost btn-sm" onClick={() => void fetchLogs()} title="Refresh logs">
              ⟳ Refresh
            </button>
            <button type="button" className="btn ghost btn-sm" onClick={onClose}>
              ✕
            </button>
          </div>
        </header>

        {workspaces.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '6px',
              padding: '10px 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px' }}>Workspace:</span>
            <button
              type="button"
              className={`btn btn-sm ${selectedWorkspace === 'all' ? 'primary' : 'ghost'}`}
              onClick={() => setSelectedWorkspace('all')}
              style={{ fontSize: '11px', padding: '2px 8px' }}
            >
              All Workspaces ({logs.length})
            </button>
            {workspaces.map((ws) => (
              <button
                key={ws}
                type="button"
                className={`btn btn-sm ${selectedWorkspace === ws ? 'primary' : 'ghost'}`}
                onClick={() => setSelectedWorkspace(ws)}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                {ws} ({logs.filter((l) => l.workspaceId === ws).length})
              </button>
            ))}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading run logs…</div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No scraping runs recorded yet for this project.
              <div style={{ fontSize: '12px', marginTop: '6px' }}>Click &quot;Scrape&quot; on any connected source to trigger a run.</div>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const dateStr = new Date(log.ts).toLocaleString()
              const isExpanded = expandedRunIds.has(log.runId)
              const hasSnippets = log.snippets && log.snippets.length > 0

              return (
                <div
                  key={log.runId}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: log.status === 'connected' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: log.status === 'connected' ? '#22c55e' : '#ef4444'
                        }}
                      >
                        {log.status === 'connected' ? 'Success' : log.status}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>
                        {log.trigger === 'manual' ? 'Manual Scrape' : 'Scheduled Scrape'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({log.sourceKind})</span>
                      {log.workspaceId && (
                        <span
                          style={{
                            fontSize: '11px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            color: '#94a3b8'
                          }}
                        >
                          {log.workspaceId}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{dateStr}</span>
                  </div>

                  <div style={{ fontSize: '13px', display: 'flex', gap: '20px', color: 'var(--text-secondary)' }}>
                    <span>Channels read: <b>{log.channelsRead}</b></span>
                    <span>New messages: <b style={{ color: log.newMessages > 0 ? '#22c55e' : 'inherit' }}>{log.newMessages}</b></span>
                    <span>Duration: <b>{log.durationMs}ms</b></span>
                  </div>

                  {(log.error || log.errorCode) && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#f87171',
                        background: 'rgba(239, 68, 68, 0.08)',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        borderLeft: '3px solid #ef4444'
                      }}
                    >
                      <b>Error detail:</b> {log.error || log.errorCode}
                    </div>
                  )}

                  {hasSnippets && (
                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px' }}>
                      <button
                        type="button"
                        onClick={() => toggleRunExpand(log.runId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#38bdf8',
                          fontSize: '11px',
                          cursor: 'pointer',
                          padding: '0 0 6px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {isExpanded ? 'Hide Message Snippets ▴' : `View Extracted Message Snippets (${log.snippets!.length}) ▾`}
                      </button>

                      {isExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                          {log.snippets!.map((snip, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: '12px',
                                padding: '6px 10px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: '4px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#818cf8', fontSize: '11px' }}>
                                <span>
                                  <b>{snip.channelName ? `#${snip.channelName}` : snip.channelId}</b> · <span style={{ color: '#f8fafc' }}>{snip.sender}</span>
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>{snip.ts}</span>
                              </div>
                              <div style={{ color: '#cbd5e1', wordBreak: 'break-word', marginTop: '2px' }}>
                                {snip.snippet}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
