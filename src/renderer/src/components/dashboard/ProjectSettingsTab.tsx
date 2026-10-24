import type React from 'react'
import { useState } from 'react'
import type { DashboardProject } from '../../../../shared/dashboard-contract'
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
