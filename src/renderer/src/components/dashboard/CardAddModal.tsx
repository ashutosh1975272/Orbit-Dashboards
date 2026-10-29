import React, { useState } from 'react'
import { useProfileStore } from '../../hooks/useProfiles'
import { useDashboardStore } from '../../hooks/useDashboard'
import type { DashboardProject, ProjectSource } from '../../../../shared/dashboard-contract'
import { POPULAR_PRESETS } from './AddPlatformPage'

interface CardAddModalProps {
  open: boolean
  project: DashboardProject
  onClose: () => void
  onSuccess?: (msg: string) => void
}

export function CardAddModal({
  open,
  project,
  onClose,
  onSuccess
}: CardAddModalProps): React.JSX.Element | null {
  const [tab, setTab] = useState<'global' | 'client' | 'links'>('global')
  const profiles = useProfileStore((s) => s.profiles)
  const upsertProject = useDashboardStore((s) => s.upsertProject)

  // Global & Client Workspaces
  const workspaceOptions = profiles.flatMap((p) =>
    p.apps.slack.availableWorkspaces.map((w) => ({
      profileId: p.id,
      profileName: p.customName || p.displayName,
      teamId: w.teamId,
      teamName: w.teamName
    }))
  )

  const [selectedKey, setSelectedKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Custom link state
  const [linkName, setLinkName] = useState('')
  const [linkUrl, setLinkUrl] = useState('')

  if (!open) return null

  const handleAddWorkspaceSource = async (role: 'client' | 'ours') => {
    if (!selectedKey) return
    const [pId, tId] = selectedKey.split(':')
    const opt = workspaceOptions.find((o) => o.profileId === pId && o.teamId === tId)
    if (!opt) return

    setBusy(true)
    setError(null)
    try {
      const existingSources = project.sources ?? []
      const duplicate = existingSources.some(
        (s) => s.workspaceId === opt.teamId && s.profileId === opt.profileId
      )
      if (duplicate) {
        setError(`${opt.teamName} is already added as a source for this project.`)
        return
      }

      const now = new Date().toISOString()
      const newSource: ProjectSource = {
        id: `src-browser-${Date.now().toString(36)}`,
        kind: 'browser',
        platform: 'slack',
        profileId: opt.profileId,
        workspaceId: opt.teamId,
        workspaceName: opt.teamName,
        channels: project.monitors.map((m) => ({ id: m.channelId, name: m.channelName })),
        role,
        backfillDays: 7,
        enabled: true,
        status: 'connected',
        createdAt: now,
        updatedAt: now
      }

      await upsertProject({
        ...project,
        sources: [...existingSources, newSource]
      })

      onSuccess?.(`Added ${opt.teamName} to ${project.name}`)
      onClose()
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setBusy(false)
    }
  }

  const handleAddCustomLink = async () => {
    if (!linkName.trim() || !linkUrl.trim()) {
      setError('Please provide a name and URL')
      return
    }
    const targetProfileId = project.profileId || profiles[0]?.id
    if (!targetProfileId) {
      setError('No profile available to attach link to')
      return
    }

    setBusy(true)
    setError(null)
    try {
      await window.api.profiles.addCustomLink(targetProfileId, {
        name: linkName.trim(),
        url: linkUrl.trim().startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`
      })
      await useProfileStore.getState().loadProfiles()
      onSuccess?.(`Added ${linkName.trim()} link`)
      onClose()
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to save link')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="platform-settings-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ zIndex: 1400 }}
    >
      <div
        className="platform-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Add to Project Card"
        style={{
          width: '520px',
          maxWidth: '92vw',
          backgroundColor: '#090d16',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <header
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.6)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>➕</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>
              Add to {project.name}
            </h3>
          </div>
          <button
            type="button"
            className="btn ghost"
            onClick={onClose}
            style={{ color: '#94a3b8', fontSize: '13px' }}
          >
            ✕
          </button>
        </header>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0 20px',
            background: 'rgba(0, 0, 0, 0.2)'
          }}
        >
          <button
            type="button"
            onClick={() => { setTab('global'); setError(null) }}
            style={{
              padding: '10px 14px',
              fontSize: '12px',
              fontWeight: 600,
              color: tab === 'global' ? '#fff' : 'var(--text-faint)',
              borderBottom: tab === 'global' ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer'
            }}
          >
            🌐 Global Workspaces
          </button>
          <button
            type="button"
            onClick={() => { setTab('client'); setError(null) }}
            style={{
              padding: '10px 14px',
              fontSize: '12px',
              fontWeight: 600,
              color: tab === 'client' ? '#fff' : 'var(--text-faint)',
              borderBottom: tab === 'client' ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer'
            }}
          >
            🏢 Client Workspaces
          </button>
          <button
            type="button"
            onClick={() => { setTab('links'); setError(null) }}
            style={{
              padding: '10px 14px',
              fontSize: '12px',
              fontWeight: 600,
              color: tab === 'links' ? '#fff' : 'var(--text-faint)',
              borderBottom: tab === 'links' ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer'
            }}
          >
            🔗 Web Platforms & Links
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '6px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {tab === 'global' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                Select an existing authenticated workspace to add as a real-time scraping and intelligence source for this project card.
              </p>
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  background: '#020617',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  fontSize: '13px'
                }}
              >
                <option value="">-- Choose global workspace source --</option>
                {workspaceOptions.map((opt) => (
                  <option key={`${opt.profileId}:${opt.teamId}`} value={`${opt.profileId}:${opt.teamId}`}>
                    {opt.teamName} ({opt.profileName})
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!selectedKey || busy}
                  onClick={() => void handleAddWorkspaceSource('ours')}
                >
                  {busy ? 'Adding…' : 'Add Workspace Source'}
                </button>
              </div>
            </div>
          )}

          {tab === 'client' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                Connect a dedicated client workspace source to stream channel communications directly into this card.
              </p>
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  background: '#020617',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  fontSize: '13px'
                }}
              >
                <option value="">-- Choose client workspace --</option>
                {workspaceOptions.map((opt) => (
                  <option key={`${opt.profileId}:${opt.teamId}`} value={`${opt.profileId}:${opt.teamId}`}>
                    {opt.teamName} ({opt.profileName})
                  </option>
                ))}
              </select>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!selectedKey || busy}
                  onClick={() => void handleAddWorkspaceSource('client')}
                >
                  {busy ? 'Connecting…' : 'Add Client Workspace'}
                </button>
              </div>
            </div>
          )}

          {tab === 'links' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                Add custom tool links or popular platforms (Discord, Claude, Notion, Linear, GitHub) accessible from this card.
              </p>

              {/* Presets */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {POPULAR_PRESETS.slice(0, 6).map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setLinkName(preset.name)
                      setLinkUrl(preset.url)
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      color: '#cbd5e1',
                      cursor: 'pointer'
                    }}
                  >
                    {preset.icon} {preset.name}
                  </button>
                ))}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: 4 }}>
                  Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Discord, Linear, Figma, GitHub"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#020617',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: 4 }}>
                  URL
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#020617',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!linkName || !linkUrl || busy}
                  onClick={() => void handleAddCustomLink()}
                >
                  {busy ? 'Saving…' : 'Add Link'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
