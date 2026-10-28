import type React from 'react'
import { useEffect, useState } from 'react'
import type {
  DashboardChatTokenStatus,
  DashboardProject
} from '../../../../shared/dashboard-contract'
import { useDashboardStore } from '../../hooks/useDashboard'
import AiSettingsForm from './AiSettingsForm'
import DashboardWizard from './DashboardWizard'
import { SidebarLayoutView } from './SidebarLayoutView'
import {
  LayoutMode,
  DEFAULT_LAYOUT
} from './sidebar-layout'
import { useSidebarLayout } from './use-sidebar-layout'

export type SettingsTabKey = 'general' | 'ai' | 'channels' | 'schedule' | 'sidebar' | 'danger'

interface ProjectSettingsTabProps {
  project: DashboardProject
  onDelete?: (projectId: string) => void
}

export default function ProjectSettingsTab({
  project,
  onDelete
}: ProjectSettingsTabProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('ai')
  const [editWorkspace, setEditWorkspace] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Schedule state
  const [startDate, setStartDate] = useState(project.startDate ?? '')
  const [endDate, setEndDate] = useState(project.endDate ?? '')
  const [completion, setCompletion] = useState(
    project.manualCompletion != null ? String(project.manualCompletion) : ''
  )
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  // Layout state
  const { layout, updateLayout } = useSidebarLayout(project.id)

  // Token status
  const [tokenStatus, setTokenStatus] = useState<DashboardChatTokenStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.api.dashboard
      .getChatTokenStatus(project.id)
      .then((status) => {
        if (!cancelled) setTokenStatus(status)
      })
      .catch(() => {
        if (!cancelled) setTokenStatus(null)
      })
    return () => {
      cancelled = true
    }
  }, [project.id])

  const handleModeChange = (mode: LayoutMode): void => {
    updateLayout({ ...layout, mode })
  }

  const handleToggleSection = (sectionKey: string): void => {
    const hidden = new Set(layout.custom.hiddenSections)
    if (hidden.has(sectionKey)) {
      hidden.delete(sectionKey)
    } else {
      hidden.add(sectionKey)
    }
    updateLayout({
      ...layout,
      custom: { ...layout.custom, hiddenSections: Array.from(hidden) }
    })
  }

  const handleResetLayout = (): void => {
    updateLayout(DEFAULT_LAYOUT)
  }

  const saveSchedule = async (): Promise<void> => {
    setScheduleSaving(true)
    setScheduleNotice(null)
    setScheduleError(null)
    try {
      const parsed = completion === '' ? undefined : Number(completion)
      await useDashboardStore.getState().upsertProject({
        ...project,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        manualCompletion:
          parsed === undefined || !Number.isFinite(parsed)
            ? undefined
            : Math.max(0, Math.min(100, Math.round(parsed)))
      })
      setScheduleNotice('Schedule saved')
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Could not save the schedule')
    } finally {
      setScheduleSaving(false)
    }
  }

  const handleDeleteProject = async (): Promise<void> => {
    if (onDelete) {
      onDelete(project.id)
    } else {
      await useDashboardStore.getState().deleteProject(project.id)
    }
  }

  const isScheduleChanged =
    startDate !== (project.startDate ?? '') ||
    endDate !== (project.endDate ?? '') ||
    completion !== (project.manualCompletion != null ? String(project.manualCompletion) : '')

  return (
    <div className="ws-settings" data-testid="project-settings-tab">
      <div className="ws-settings-shell">
        {/* Sticky Header */}
        <header className="ws-settings-header" data-testid="settings-header">
          <div className="ws-settings-title-row">
            <div>
              <h2 className="ws-settings-title">
                <span className="proj-name">{project.name}</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span>Settings</span>
              </h2>
              <p className="ws-settings-sub">
                Model, key, channels and dates for this card.
              </p>
            </div>
          </div>

          <nav className="ws-settings-tabs" role="tablist" aria-label="Settings sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'general'}
              className={`ws-settings-tab-btn${activeTab === 'general' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('general')}
              data-testid="tab-general"
            >
              General
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'ai'}
              className={`ws-settings-tab-btn${activeTab === 'ai' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('ai')}
              data-testid="tab-ai"
            >
              AI
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'channels'}
              className={`ws-settings-tab-btn${activeTab === 'channels' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('channels')}
              data-testid="tab-channels"
            >
              Channels
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'schedule'}
              className={`ws-settings-tab-btn${activeTab === 'schedule' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('schedule')}
              data-testid="tab-schedule"
            >
              Schedule
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'sidebar'}
              className={`ws-settings-tab-btn${activeTab === 'sidebar' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('sidebar')}
              data-testid="tab-sidebar"
            >
              Sidebar layout
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'danger'}
              className={`ws-settings-tab-btn${activeTab === 'danger' ? ' is-active' : ''}`}
              onClick={() => setActiveTab('danger')}
              data-testid="tab-danger"
              style={{ color: activeTab === 'danger' ? 'var(--danger)' : undefined }}
            >
              Danger zone
            </button>
          </nav>
        </header>

        {/* Single Scroll Container */}
        <div className="ws-settings-content" data-testid="settings-content">
          {/* TAB: GENERAL */}
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <section className="ws-settings-section">
                <header className="ws-settings-head">
                  <h4>General information</h4>
                  <p>Basic workspace metadata and card identity.</p>
                </header>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Project name
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={project.name}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-input)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Client workspace
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={project.clientName || project.teamName || '—'}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-input)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Project ID
                    </label>
                    <code
                      style={{
                        display: 'inline-block',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-chip)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                        fontSize: '12px'
                      }}
                    >
                      {project.id}
                    </code>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB: AI */}
          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <section
                className="ws-settings-section"
                id="project-ai-settings"
                tabIndex={-1}
                aria-label="AI settings"
              >
                <header className="ws-settings-head">
                  <h4>AI configuration</h4>
                  <p>
                    Used by this card&apos;s insight refresh and project chat. Leave{' '}
                    <b>Use global settings</b> on to inherit the dashboard workspace key and model.
                  </p>
                </header>
                <AiSettingsForm projectId={project.id} />
              </section>
            </div>
          )}

          {/* TAB: CHANNELS */}
          {activeTab === 'channels' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <section className="ws-settings-section">
                <header className="ws-settings-head">
                  <h4>Workspace &amp; channels</h4>
                  <p>
                    Connector: <b>{project.tokenSource === 'oauth' ? 'OAuth app' : 'manual token'}</b> ·{' '}
                    {project.teamName ?? project.teamId} ·{' '}
                    {project.monitors.map((m) => `#${m.channelName}`).join(', ') || 'no channels'}
                  </p>
                </header>
                {editWorkspace ? (
                  <DashboardWizard inline projectId={project.id} onDone={() => setEditWorkspace(false)} />
                ) : (
                  <button type="button" className="dash-subtle" onClick={() => setEditWorkspace(true)}>
                    Edit workspace &amp; channels
                  </button>
                )}
              </section>

              <section className="ws-settings-section">
                <header className="ws-settings-head">
                  <h4>Slack token &amp; permissions</h4>
                  <p>
                    Read-only here. Slack Chat reads history with this token; sending replies additionally
                    needs the <b>chat:write</b> scope.
                  </p>
                </header>
                {tokenStatus === null ? (
                  <p className="ws-settings-token-state">Checking token…</p>
                ) : (
                  <div className="ws-settings-token">
                    <p className="ws-settings-token-state">
                      {tokenStatus.connected ? (
                        <span className="ws-settings-token-dot ok" aria-hidden="true" />
                      ) : (
                        <span className="ws-settings-token-dot off" aria-hidden="true" />
                      )}
                      <b>
                        {tokenStatus.connected
                          ? tokenStatus.source === 'oauth'
                            ? 'Connected via OAuth app'
                            : 'Connected via manual token'
                          : 'Not connected'}
                      </b>
                      {tokenStatus.teamName ? ` · ${tokenStatus.teamName}` : ''}
                    </p>
                    {tokenStatus.maskedToken ? (
                      <p className="ws-settings-token-line">
                        Token:{' '}
                        <span className="proj-token-chip selectable">
                          {tokenStatus.maskedToken.replace(/[`'"]/g, '')}
                        </span>{' '}
                        (full token stays encrypted in this app)
                      </p>
                    ) : null}
                    {tokenStatus.scopes ? (
                      <p className="ws-settings-token-line">
                        Scopes: <code className="selectable">{tokenStatus.scopes.join(', ')}</code>
                      </p>
                    ) : tokenStatus.connected ? (
                      <p className="ws-settings-token-line">
                        Slack doesn&apos;t report scopes for this token type — sending is decided by the
                        token; errors surface when you send.
                      </p>
                    ) : null}
                    {tokenStatus.canSend === true ? (
                      <p className="ai-settings-notice">Sending is enabled — chat:write is granted.</p>
                    ) : null}
                    {tokenStatus.canSend === false ? (
                      <p className="ai-settings-error">
                        Read-only: this token is missing the <b>chat:write</b> scope, so Orbit cannot post
                        replies. Add <b>chat:write</b> to the Slack app&apos;s User Token Scopes (OAuth
                        &amp; Permissions), reinstall or reconnect the workspace, then try again.
                      </p>
                    ) : null}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB: SCHEDULE */}
          {activeTab === 'schedule' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <section className="ws-settings-section">
                <header className="ws-settings-head">
                  <h4>Schedule &amp; completion</h4>
                  <p>Manual values win over dates and percentages the AI finds in chat.</p>
                </header>
                <div className="ws-settings-grid">
                  <label className="ai-settings-field">
                    <span>Start date</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value)
                        setScheduleNotice(null)
                      }}
                    />
                  </label>
                  <label className="ai-settings-field">
                    <span>End date / deadline</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value)
                        setScheduleNotice(null)
                      }}
                    />
                  </label>
                  <label className="ai-settings-field">
                    <span>Completion % (0–100)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="auto"
                      value={completion}
                      onChange={(e) => {
                        setCompletion(e.target.value)
                        setScheduleNotice(null)
                      }}
                    />
                    <small style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Leave empty to auto-calculate from project activity.
                    </small>
                  </label>
                </div>
                {scheduleError ? <p className="ai-settings-error">{scheduleError}</p> : null}
                {scheduleNotice ? <p className="ai-settings-notice">{scheduleNotice}</p> : null}
                <div className="ai-settings-actions" style={{ marginTop: '16px' }}>
                  <button
                    type="button"
                    className="dash-primary"
                    disabled={scheduleSaving || !isScheduleChanged}
                    onClick={() => void saveSchedule()}
                  >
                    {scheduleSaving ? 'Saving…' : 'Save schedule'}
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* TAB: SIDEBAR LAYOUT */}
          {activeTab === 'sidebar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <section className="ws-settings-section">
                <header className="ws-settings-head">
                  <h4>Sidebar layout</h4>
                  <p>Choose what appears in this project card&apos;s navigation sidebar.</p>
                </header>
                <SidebarLayoutView
                  layout={layout}
                  onModeChange={handleModeChange}
                  onToggleSection={handleToggleSection}
                  onReset={handleResetLayout}
                />
              </section>
            </div>
          )}

          {/* TAB: DANGER ZONE */}
          {activeTab === 'danger' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <section className="ws-settings-section is-danger">
                <header className="ws-settings-head">
                  <h4 style={{ color: 'var(--danger)' }}>Danger zone</h4>
                  <p>Irreversible actions for this project card.</p>
                </header>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0 }}>
                    Deleting this card will stop all automated syncing, clear its insight cache, and remove it from the dashboard.
                  </p>
                  {confirmDelete ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        style={{
                          background: 'var(--danger)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 16px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                        onClick={() => void handleDeleteProject()}
                        data-testid="confirm-delete-project"
                      >
                        Yes, permanently delete {project.name}
                      </button>
                      <button
                        type="button"
                        className="dash-subtle"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        style={{
                          background: 'transparent',
                          color: 'var(--danger)',
                          border: '1px solid var(--danger)',
                          borderRadius: '8px',
                          padding: '8px 14px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        onClick={() => setConfirmDelete(true)}
                        data-testid="delete-project-btn"
                      >
                        Delete this project
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <footer className="ws-settings-footer" data-testid="settings-footer">
          <div className="ws-settings-footer-left">
            {isScheduleChanged && activeTab === 'schedule' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warn)' }}>
                <span className="ws-settings-unsaved-dot" />
                <span>Unsaved changes</span>
              </span>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                Settings are saved per section.
              </span>
            )}
          </div>
          <div className="ws-settings-footer-right">
            {activeTab === 'schedule' ? (
              <button
                type="button"
                className="dash-primary"
                disabled={scheduleSaving || !isScheduleChanged}
                onClick={() => void saveSchedule()}
              >
                {scheduleSaving ? 'Saving…' : 'Save schedule'}
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  )
}
