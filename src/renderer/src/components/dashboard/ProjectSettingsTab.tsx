import type React from 'react'
import { useEffect, useState } from 'react'
import type { DashboardChatTokenStatus, DashboardProject } from '../../../../shared/dashboard-contract'
import { useDashboardStore } from '../../hooks/useDashboard'
import AiSettingsForm from './AiSettingsForm'
import DashboardWizard from './DashboardWizard'

interface ProjectSettingsTabProps {
  project: DashboardProject
}

export default function ProjectSettingsTab({
  project
}: ProjectSettingsTabProps): React.ReactElement {
  const [editWorkspace, setEditWorkspace] = useState(false)
  const [startDate, setStartDate] = useState(project.startDate ?? '')
  const [endDate, setEndDate] = useState(project.endDate ?? '')
  const [completion, setCompletion] = useState(
    project.manualCompletion != null ? String(project.manualCompletion) : ''
  )
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tokenStatus, setTokenStatus] = useState<DashboardChatTokenStatus | null>(null)

  useEffect(() => {
    let cancelled = false
    setTokenStatus(null)
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

  const saveSchedule = async (): Promise<void> => {
    setSaving(true)
    setNotice(null)
    setError(null)
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
      setNotice('Schedule saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the schedule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ws-settings">
      <section className="ws-settings-section">
        <header className="ws-settings-head">
          <h4>AI settings</h4>
          <p>
            Used by this card&apos;s insight refresh and project chat. Leave{' '}
            <b>Use global settings</b> on to inherit the dashboard workspace key and model.
          </p>
        </header>
        <AiSettingsForm projectId={project.id} />
      </section>

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
            Read-only here. Slack Chat reads history with this token; sending replies
            additionally needs the <b>chat:write</b> scope.
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
                Token: <code>{tokenStatus.maskedToken}</code> (full token stays encrypted in this app)
              </p>
            ) : null}
            {tokenStatus.scopes ? (
              <p className="ws-settings-token-line">
                Scopes: <code>{tokenStatus.scopes.join(', ')}</code>
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
                replies. Add <b>chat:write</b> to the Slack app&apos;s User Token Scopes (OAuth &amp;
                Permissions), reinstall or reconnect the workspace, then try again.
              </p>
            ) : null}
          </div>
        )}
      </section>

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
                setNotice(null)
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
                setNotice(null)
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
                setNotice(null)
              }}
            />
          </label>
        </div>
        {error ? <p className="ai-settings-error">{error}</p> : null}
        {notice ? <p className="ai-settings-notice">{notice}</p> : null}
        <div className="ai-settings-actions">
          <button
            type="button"
            className="dash-primary"
            disabled={saving}
            onClick={() => void saveSchedule()}
          >
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
        </div>
      </section>
    </div>
  )
}
