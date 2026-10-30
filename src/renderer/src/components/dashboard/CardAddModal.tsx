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
  const [tab, setTab] = useState<'global' | 'my' | 'client'>('global')
  const profiles = useProfileStore((s) => s.profiles)
  const upsertProject = useDashboardStore((s) => s.upsertProject)

  // Profile-grouped structure of all available workspaces and links
  const profileGroups = profiles.map((p) => {
    const pName = p.customName || p.displayName
    const slackWorkspaces = p.apps?.slack?.availableWorkspaces ?? []
    const customLinks = p.customLinks ?? []
    return {
      profileId: p.id,
      profileName: pName,
      slackWorkspaces,
      customLinks,
      hasItems: slackWorkspaces.length > 0 || customLinks.length > 0
    }
  }).filter((g) => g.hasItems)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form states for My Accounts & Client Accounts
  const [itemPlatform, setItemPlatform] = useState('slack')
  const [itemName, setItemName] = useState('')
  const [itemUrl, setItemUrl] = useState('')

  if (!open) return null

  const handleAddWorkspaceFromGlobal = async (
    profileId: string,
    teamId: string,
    teamName: string,
    role: 'client' | 'ours'
  ) => {
    setBusy(true)
    setError(null)
    try {
      const existingSources = project.sources ?? []
      const duplicate = existingSources.some(
        (s) => s.workspaceId === teamId && s.profileId === profileId
      )
      if (duplicate) {
        setError(`${teamName} is already added as a source for this project.`)
        return
      }

      const now = new Date().toISOString()
      const newSource: ProjectSource = {
        id: `src-browser-${Date.now().toString(36)}`,
        kind: 'browser',
        platform: 'slack',
        profileId,
        workspaceId: teamId,
        workspaceName: teamName,
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

      onSuccess?.(`Added ${teamName} to ${project.name}`)
      onClose()
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
    } finally {
      setBusy(false)
    }
  }

  const handleAddCustomAccount = async (role: 'client' | 'ours') => {
    if (!itemName.trim()) {
      setError('Please provide an account or channel name')
      return
    }

    const targetProfileId = project.profileId || profiles[0]?.id
    if (!targetProfileId) {
      setError('No profile available to attach to')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const formattedUrl = itemUrl.trim()
        ? (itemUrl.trim().startsWith('http') ? itemUrl.trim() : `https://${itemUrl.trim()}`)
        : undefined

      // If it's a URL, attach to profile links
      if (formattedUrl) {
        await window.api.profiles.addCustomLink(targetProfileId, {
          name: `${itemName.trim()} (${role === 'client' ? 'Client' : 'My Account'})`,
          url: formattedUrl
        })
        await useProfileStore.getState().loadProfiles()
      }

      // Also register source if slack or connector
      const now = new Date().toISOString()
      const existingSources = project.sources ?? []
      const newSource: ProjectSource = {
        id: `src-custom-${Date.now().toString(36)}`,
        kind: 'browser',
        platform: (itemPlatform as any) || 'slack',
        profileId: targetProfileId,
        workspaceId: `custom-${Date.now().toString(36)}`,
        workspaceName: itemName.trim(),
        channels: [],
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

      onSuccess?.(`Added ${itemName.trim()} to ${role === 'client' ? 'Client Accounts' : 'My Accounts'}`)
      onClose()
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to save account')
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
          width: '560px',
          maxWidth: '92vw',
          maxHeight: '85vh',
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
              fontSize: '12.5px',
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
            🌐 Global Workspaces &amp; Links
          </button>
          <button
            type="button"
            onClick={() => { setTab('my'); setError(null) }}
            style={{
              padding: '10px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: tab === 'my' ? '#fff' : 'var(--text-faint)',
              borderBottom: tab === 'my' ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer'
            }}
          >
            👥 My Accounts
          </button>
          <button
            type="button"
            onClick={() => { setTab('client'); setError(null) }}
            style={{
              padding: '10px 14px',
              fontSize: '12.5px',
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
            🏢 Client Accounts
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '6px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {/* TAB 1: GLOBAL WORKSPACES & LINKS (PROFILE BY PROFILE) */}
          {tab === 'global' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                Pick an existing workspace or link from your authenticated profiles to attach to this card:
              </p>

              {profileGroups.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-faint)', textAlign: 'center', padding: '20px 0' }}>
                  No workspaces or links signed in yet. Add accounts in Cosmic first.
                </p>
              ) : (
                profileGroups.map((group) => (
                  <div
                    key={group.profileId}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                        👤 {group.profileName}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {group.slackWorkspaces.map((w) => (
                        <div
                          key={`${group.profileId}:${w.teamId}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            borderRadius: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13 }}>🏢</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
                              {w.teamName}
                            </span>
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
                              Slack
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn ghost"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              disabled={busy}
                              onClick={() => void handleAddWorkspaceFromGlobal(group.profileId, w.teamId, w.teamName, 'ours')}
                            >
                              + My Account
                            </button>
                            <button
                              type="button"
                              className="btn primary"
                              style={{ fontSize: 11, padding: '3px 8px' }}
                              disabled={busy}
                              onClick={() => void handleAddWorkspaceFromGlobal(group.profileId, w.teamId, w.teamName, 'client')}
                            >
                              + Client Account
                            </button>
                          </div>
                        </div>
                      ))}

                      {group.customLinks.map((link) => (
                        <div
                          key={link.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            borderRadius: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13 }}>🔗</span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
                              {link.name}
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {link.url}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn ghost"
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            onClick={() => window.open(link.url, '_blank')}
                          >
                            Open Link ↗
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2 & 3: MY ACCOUNTS / CLIENT ACCOUNTS */}
          {(tab === 'my' || tab === 'client') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
                {tab === 'my'
                  ? 'Add an internal team workspace, service, or account (Upwork, Discord, Teams, WhatsApp, etc.):'
                  : 'Add a client communication workspace, portal, or dedicated channel:'}
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: 4 }}>
                  Platform
                </label>
                <select
                  value={itemPlatform}
                  onChange={(e) => setItemPlatform(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: '#020617',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="slack">Slack</option>
                  <option value="upwork">Upwork</option>
                  <option value="teams">Microsoft Teams</option>
                  <option value="discord">Discord</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="googlechat">Google Chat</option>
                  <option value="custom">Other Web Platform</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: 4 }}>
                  Account / Workspace Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Agency Team, Client Workspace, #core-channel"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
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
                  URL or Portal Link (optional)
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={itemUrl}
                  onChange={(e) => setItemUrl(e.target.value)}
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

              {/* Quick Presets */}
              <div style={{ marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 6 }}>
                  Quick Suggestions:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {POPULAR_PRESETS.slice(0, 6).map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        setItemName(preset.name)
                        setItemUrl(preset.url)
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
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!itemName.trim() || busy}
                  onClick={() => void handleAddCustomAccount(tab === 'my' ? 'ours' : 'client')}
                >
                  {busy ? 'Adding…' : (tab === 'my' ? 'Add to My Accounts' : 'Add to Client Accounts')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
