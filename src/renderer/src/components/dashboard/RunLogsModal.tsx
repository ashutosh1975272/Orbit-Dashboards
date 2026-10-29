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

  if (!open) return null

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
        style={{ maxWidth: '680px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <header className="platform-settings-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Scraping Run Logs</h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Project: {projectName}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn ghost btn-sm" onClick={() => void fetchLogs()} title="Refresh logs">
              ⟳ Refresh
            </button>
            <button type="button" className="btn ghost btn-sm" onClick={onClose}>
              ✕
            </button>
          </div>
        </header>

        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading run logs…</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No scraping runs recorded yet for this project.
              <div style={{ fontSize: '12px', marginTop: '6px' }}>Click &quot;Scrape&quot; on any connected source to trigger a run.</div>
            </div>
          ) : (
            logs.map((log) => {
              const dateStr = new Date(log.ts).toLocaleString()
              return (
                <div
                  key={log.runId}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: log.status === 'connected' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: log.status === 'connected' ? '#22c55e' : '#ef4444'
                        }}
                      >
                        {log.status === 'connected' ? 'Success' : log.status}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>
                        {log.trigger === 'manual' ? 'Manual Scrape' : 'Scheduled Scrape'}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({log.sourceKind})</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{dateStr}</span>
                  </div>

                  <div style={{ fontSize: '13px', display: 'flex', gap: '16px', color: 'var(--text-secondary)' }}>
                    <span>Channels read: <b>{log.channelsRead}</b></span>
                    <span>New messages: <b style={{ color: log.newMessages > 0 ? '#22c55e' : 'inherit' }}>{log.newMessages}</b></span>
                    <span>Duration: <b>{log.durationMs}ms</b></span>
                  </div>

                  {log.snippets && log.snippets.length > 0 && (
                    <div style={{ marginTop: '6px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Captured Message Snippets:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {log.snippets.map((snip, idx) => (
                          <div
                            key={idx}
                            style={{
                              fontSize: '12px',
                              padding: '4px 8px',
                              background: 'rgba(255, 255, 255, 0.03)',
                              borderRadius: '4px'
                            }}
                          >
                            <span style={{ color: '#818cf8', fontWeight: 500 }}>
                              {snip.channelName ? `#${snip.channelName}` : snip.channelId}:
                            </span>{' '}
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({snip.sender})</span>{' '}
                            <span>{snip.snippet}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {log.error && (
                    <div style={{ fontSize: '12px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 8px', borderRadius: '4px' }}>
                      Error: {log.error}
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
