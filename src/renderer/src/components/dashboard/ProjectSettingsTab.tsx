import type React from 'react'
import { useEffect, useState } from 'react'
import type {
  DashboardChatTokenStatus,
  DashboardProject
} from '../../../../shared/dashboard-contract'
import { useDashboardStore } from '../../hooks/useDashboard'
import AiSettingsForm from './AiSettingsForm'
import DashboardWizard from './DashboardWizard'
import { RunLogsModal } from './RunLogsModal'
import { SidebarLayoutView } from './SidebarLayoutView'
import {
  LayoutMode,
  DEFAULT_LAYOUT
} from './sidebar-layout'
import { useSidebarLayout } from './use-sidebar-layout'
import {
  SourceStatusBadge,
  WorkspacePicker,
  type ProfileWorkspaceOption
} from './sources'
import { useProfileStore } from '../../hooks/useProfiles'
import type { ProjectSource } from '../../../../shared/dashboard-contract'

export type SettingsTabKey = 'general' | 'ai' | 'sources' | 'channels' | 'schedule' | 'sidebar' | 'danger'

interface ProjectSettingsTabProps {
  project: DashboardProject
  onDelete?: (projectId: string) => void
}

export default function ProjectSettingsTab({
  project,
  onDelete
}: ProjectSettingsTabProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('ai')
  const [navCollapsed, setNavCollapsed] = useState(false)
  const [editWorkspace, setEditWorkspace] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Sources management state
  const profiles = useProfileStore((s) => s.profiles)
  const workspaceOptions: ProfileWorkspaceOption[] = profiles.flatMap((p) =>
    p.apps.slack.availableWorkspaces.map((w) => ({
      profileId: p.id,
      profileEmail: p.customName || p.displayName,
      workspaceId: w.teamId,
      workspaceName: w.teamName
    }))
  )
  const [newSourceKey, setNewSourceKey] = useState('')
  const [addingSource, setAddingSource] = useState(false)
  const [sourceNotice, setSourceNotice] = useState<string | null>(null)
  const [scrapingSourceId, setScrapingSourceId] = useState<string | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)

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

  const navItems: Array<{ key: SettingsTabKey; label: string; icon: string; danger?: boolean }> = [
    { key: 'general', label: 'General', icon: 'ℹ' },
    { key: 'ai', label: 'AI Configuration', icon: '✨' },
    { key: 'sources', label: 'Sources', icon: '🔌' },
    { key: 'channels', label: 'Channels', icon: '#' },
    { key: 'schedule', label: 'Schedule', icon: '📅' },
    { key: 'sidebar', label: 'Sidebar layout', icon: '◫' },
    { key: 'danger', label: 'Danger zone', icon: '⚠', danger: true }
  ]

  const handleToggleSourceEnabled = async (sourceId: string, currentEnabled: boolean): Promise<void> => {
    const updatedSources = (project.sources ?? []).map((s) =>
      s.id === sourceId ? { ...s, enabled: !currentEnabled } : s
    )
    await useDashboardStore.getState().upsertProject({
      ...project,
      sources: updatedSources
    })
    setSourceNotice(`Source ${currentEnabled ? 'paused' : 'resumed'}`)
    setTimeout(() => setSourceNotice(null), 3000)
  }

  const handleAddBrowserSource = async (): Promise<void> => {
    if (!newSourceKey) return
    const [profId, teamId] = newSourceKey.split(':')
    const opt = workspaceOptions.find((o) => `${o.profileId}:${o.workspaceId}` === newSourceKey)
    const now = new Date().toISOString()
    const newSource: ProjectSource = {
      id: `src-browser-${Date.now().toString(36)}`,
      kind: 'browser',
      platform: 'slack',
      profileId: profId,
      workspaceId: teamId,
      workspaceName: opt?.workspaceName || 'Slack Workspace',
      channels: project.monitors.map((m) => ({ id: m.channelId, name: m.channelName })),
      role: 'client',
      backfillDays: 7,
      enabled: true,
      status: 'connected',
      createdAt: now,
      updatedAt: now
    }
    const currentSources = project.sources ?? []
    await useDashboardStore.getState().upsertProject({
      ...project,
      sources: [...currentSources, newSource]
    })
    setAddingSource(false)
    setNewSourceKey('')
    setSourceNotice('Browser source added')
    setTimeout(() => setSourceNotice(null), 3000)
  }

  const handleScrapeSource = async (sourceId: string): Promise<void> => {
    setScrapingSourceId(sourceId)
    setSourceNotice('Scraping workspace messages via browser...')
    try {
      const res = await useDashboardStore.getState().syncSource({
        projectId: project.id,
        sourceId
      })
      if (res.status === 'success') {
        setSourceNotice(`Scraped successfully: ${res.newMessages} new messages found across ${res.channelsRead} channels.`)
      } else {
        setSourceNotice(res.error ? `Scrape failed: ${res.error}` : 'Scrape completed with issues.')
      }
    } catch (err) {
      setSourceNotice(err instanceof Error ? `Scrape error: ${err.message}` : 'Scrape failed')
    } finally {
      setScrapingSourceId(null)
      setTimeout(() => setSourceNotice(null), 5000)
    }
  }

  const handleRemoveSource = async (sourceId: string): Promise<void> => {
    const updatedSources = (project.sources ?? []).filter((s) => s.id !== sourceId)
    await useDashboardStore.getState().upsertProject({
      ...project,
      sources: updatedSources
    })
    setSourceNotice('Source removed')
    setTimeout(() => setSourceNotice(null), 3000)
  }

  return (
    <div className="ws-settings" data-testid="project-settings-tab">
      <div className="ws-settings-shell">
        {/* Sticky Header */}
        <header className="ws-settings-header" data-testid="settings-header">
          <div className="ws-settings-title-row">
            <div className="ws-settings-title-group">
              <h2 className="ws-settings-title">
                <span className="proj-name">{project.name}</span>
                <span className="proj-sep">/</span>
                <span className="proj-sub">Settings</span>
              </h2>
            </div>
          </div>
        </header>

        {/* Vertical Layout with Collapsible Nav Sidebar */}
        <div className="ws-settings-layout">
          <aside className={`ws-settings-nav-sidebar${navCollapsed ? ' is-collapsed' : ''}`} aria-label="Settings navigation">
            <div className="ws-settings-nav-toggle">
              <button
                type="button"
                className="ws-settings-nav-toggle-btn"
                onClick={() => setNavCollapsed((v) => !v)}
                title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
              >
                {navCollapsed ? '»' : '«'}
              </button>
            </div>
            <ul className="ws-settings-nav-list" role="tablist">
              {navItems.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === item.key}
                    className={`ws-settings-nav-item${activeTab === item.key ? ' is-active' : ''}${item.danger ? ' is-danger' : ''}`}
                    onClick={() => setActiveTab(item.key)}
                    data-testid={`tab-${item.key}`}
                    title={navCollapsed ? item.label : undefined}
                  >
                    <span className="ws-settings-nav-icon">{item.icon}</span>
                    {!navCollapsed && <span className="ws-settings-nav-label">{item.label}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="ws-settings-main-pane">
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

          {/* TAB: SOURCES */}
          {activeTab === 'sources' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <section className="ws-settings-section">
                <header className="ws-settings-head">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4>Connected Sources</h4>
                      <p>Active token and passive browser automation sources feeding this project.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="dash-subtle"
                        onClick={() => setLogsOpen(true)}
                        style={{ fontSize: 13, padding: '6px 12px' }}
                      >
                        📋 View Run Logs
                      </button>
                      {!addingSource && (
                        <button
                          type="button"
                          className="dash-primary"
                          onClick={() => setAddingSource(true)}
                          style={{ fontSize: 13, padding: '6px 12px' }}
                        >
                          + Add Browser Source
                        </button>
                      )}
                    </div>
                  </div>
                </header>

                {sourceNotice && (
                  <div style={{ padding: '8px 12px', background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', borderRadius: 6, fontSize: 13 }}>
                    {sourceNotice}
                  </div>
                )}

                {addingSource && (
                  <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <h5 style={{ margin: 0, fontSize: 14 }}>Add Logged-in Slack Workspace Source</h5>
                    <WorkspacePicker
                      options={workspaceOptions}
                      selectedKey={newSourceKey}
                      onChange={(k) => setNewSourceKey(k)}
                    />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button type="button" className="dash-subtle" onClick={() => setAddingSource(false)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="dash-primary"
                        disabled={!newSourceKey}
                        onClick={() => void handleAddBrowserSource()}
                      >
                        Add Source
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(!project.sources || project.sources.length === 0) && (
                    <div style={{ padding: 16, border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                      Using default project token connection ({project.tokenSource}).
                    </div>
                  )}

                  {(project.sources ?? []).map((src) => (
                    <div
                      key={src.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        background: 'var(--surface)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <SourceStatusBadge status={src.status ?? 'connected'} lastReadAt={src.lastReadAt} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                            {src.workspaceName}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {src.kind === 'browser' ? 'Browser session' : 'Token'} · {src.channels.length} channels monitored
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {src.kind === 'browser' ? (
                          <button
                            type="button"
                            className="dash-subtle"
                            disabled={scrapingSourceId === src.id || src.enabled === false}
                            style={{ fontSize: 12, padding: '4px 8px' }}
                            onClick={() => void handleScrapeSource(src.id)}
                            title="Scrape Slack messages for this workspace"
                          >
                            {scrapingSourceId === src.id ? 'Scraping…' : '🕷 Scrape'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="dash-subtle"
                          style={{ fontSize: 12, padding: '4px 8px' }}
                          onClick={() => void handleToggleSourceEnabled(src.id, src.enabled !== false)}
                        >
                          {src.enabled !== false ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          type="button"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            fontSize: 12,
                            cursor: 'pointer',
                            padding: '4px 8px'
                          }}
                          onClick={() => void handleRemoveSource(src.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
              <section className="ws-settings-section" style={{ background: 'transparent', border: 'none', padding: 0 }}>
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
          </div>
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

      <RunLogsModal
        open={logsOpen}
        projectId={project.id}
        projectName={project.name}
        onClose={() => setLogsOpen(false)}
      />
    </div>
  )
}
