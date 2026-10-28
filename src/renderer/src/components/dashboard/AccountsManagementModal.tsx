import { useCallback, useState } from 'react'
import { CustomLink, Profile, profileDisplayLabel } from '../../../../shared/types'
import { useProfileStore } from '../../hooks/useProfiles'
import { POPULAR_PRESETS } from './AddPlatformPage'

interface AccountsManagementModalProps {
  open: boolean
  onClose: () => void
  onAddGoogleAccount?: () => void
  onSelectProfile?: (profileId: string) => void
  onOpenCustomLink?: (profileId: string, link: CustomLink) => void
}

export function AccountsManagementModal({
  open,
  onClose,
  onAddGoogleAccount,
  onSelectProfile,
  onOpenCustomLink
}: AccountsManagementModalProps): React.JSX.Element | null {
  const profiles = useProfileStore((s) => s.profiles)
  const activeProfileId = useProfileStore((s) => s.activeProfileId)
  const [addingLinkForProfileId, setAddingLinkForProfileId] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleToggleSidebarVisibility = useCallback(async (profile: Profile) => {
    try {
      const nextHidden = !profile.hiddenInSidebar
      const updated = await window.api.profiles.setHiddenInSidebar(profile.id, nextHidden)
      useProfileStore.setState((prev) => ({
        profiles: prev.profiles.map((p) => (p.id === updated.id ? updated : p))
      }))
    } catch (err) {
      console.error('Failed to toggle profile sidebar visibility', err)
    }
  }, [])

  const handleToggleLinkVisibility = useCallback(async (profileId: string, link: CustomLink) => {
    try {
      const nextHidden = !link.hiddenInSidebar
      const updated = await window.api.profiles.setLinkHiddenInSidebar(profileId, link.id, nextHidden)
      useProfileStore.setState((prev) => ({
        profiles: prev.profiles.map((p) => (p.id === updated.id ? updated : p))
      }))
    } catch (err) {
      console.error('Failed to toggle link sidebar visibility', err)
    }
  }, [])

  const handleRemoveLink = useCallback(async (profileId: string, linkId: string) => {
    try {
      const updated = await window.api.profiles.removeCustomLink(profileId, linkId)
      useProfileStore.setState((prev) => ({
        profiles: prev.profiles.map((p) => (p.id === updated.id ? updated : p))
      }))
    } catch (err) {
      console.error('Failed to remove custom link', err)
    }
  }, [])

  const handleAddPresetToProfile = useCallback(async (profileId: string, name: string, url: string) => {
    setErrorMsg(null)
    try {
      const updated = await window.api.profiles.addCustomLink(profileId, { name, url })
      useProfileStore.setState((prev) => ({
        profiles: prev.profiles.map((p) => (p.id === updated.id ? updated : p))
      }))
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const handleReorder = useCallback(
    async (index: number, direction: 'up' | 'down') => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= profiles.length) return
      const next = [...profiles]
      const [moved] = next.splice(index, 1)
      if (!moved) return
      next.splice(targetIndex, 0, moved)
      const nextIds = next.map((p) => p.id)
      const reordered = await window.api.profiles.reorder(nextIds)
      useProfileStore.setState({ profiles: reordered })
    },
    [profiles]
  )

  if (!open) return null

  return (
    <div className="add-platform-backdrop" onClick={onClose}>
      <div
        className="add-platform-panel"
        style={{ width: 'min(1200px, 96vw)', maxHeight: 'min(90vh, 850px)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Accounts and Workspaces Hub"
      >
        <div className="add-platform-header">
          <div>
            <h2>Accounts & Workspaces Hub</h2>
            <p className="add-section-sub" style={{ margin: '4px 0 0 0' }}>
              Manage all connected Google emails, Slack/Teams workspaces, custom agent tabs, and sidebar visibility.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onAddGoogleAccount && (
              <button
                type="button"
                className="btn primary btn-sm"
                onClick={() => {
                  onClose()
                  onAddGoogleAccount()
                }}
              >
                + Add Google Account
              </button>
            )}
            <button type="button" className="btn ghost btn-sm" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.85rem',
              marginBottom: '16px'
            }}
          >
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {profiles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              No accounts added yet. Enter a Google email in the sidebar to get started.
            </div>
          ) : (
            profiles.map((profile, idx) => {
              const isActive = profile.id === activeProfileId
              const isHidden = profile.hiddenInSidebar === true
              const customLinks = profile.customLinks ?? []

              return (
                <div key={profile.id} className="profile-card-hub">
                  {/* Card Header */}
                  <div className="profile-card-header">
                    <div className="profile-card-identity">
                      <div
                        className="profile-avatar-circle"
                        style={{ background: profile.avatarColor || 'var(--accent)' }}
                      >
                        {profile.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)' }}>
                            {profileDisplayLabel(profile)}
                          </span>
                          {isActive && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                                color: 'var(--accent)',
                                fontWeight: 600
                              }}
                            >
                              ACTIVE
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background:
                                profile.googleAuthStatus === 'signed-in'
                                  ? 'color-mix(in srgb, #10b981 15%, transparent)'
                                  : 'color-mix(in srgb, #f59e0b 15%, transparent)',
                              color: profile.googleAuthStatus === 'signed-in' ? '#10b981' : '#f59e0b'
                            }}
                          >
                            {profile.googleAuthStatus === 'signed-in' ? 'Google Signed In' : 'Needs Login'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                          {profile.displayName}
                        </div>
                      </div>
                    </div>

                    <div className="profile-card-actions">
                      <button
                        type="button"
                        className="btn ghost btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                        onClick={() => handleReorder(idx, 'up')}
                        disabled={idx === 0}
                        title="Move account up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="btn ghost btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                        onClick={() => handleReorder(idx, 'down')}
                        disabled={idx === profiles.length - 1}
                        title="Move account down"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className={`btn ${isHidden ? 'ghost' : 'primary'} btn-sm`}
                        style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                        onClick={() => handleToggleSidebarVisibility(profile)}
                        title="Toggle visibility in left sidebar"
                      >
                        {isHidden ? '🚫 Hidden in sidebar' : '👁 Shown in sidebar'}
                      </button>
                    </div>
                  </div>

                  {/* Connected Workspaces Rows */}
                  <div
                    style={{
                      background: 'var(--surface)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      fontSize: '0.83rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>💬 Slack:</span>
                      <strong style={{ color: profile.apps.slack.sessionStatus === 'signed-in' ? '#10b981' : 'var(--muted)' }}>
                        {profile.apps.slack.sessionStatus === 'signed-in' ? 'Connected' : 'Not signed in'}
                      </strong>
                      {profile.apps.slack.pinnedWorkspaces.length > 0 && (
                        <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>
                          ({profile.apps.slack.pinnedWorkspaces.length} workspace mapped)
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>👥 Teams:</span>
                      <strong style={{ color: profile.apps.teams.sessionStatus === 'signed-in' ? '#10b981' : 'var(--muted)' }}>
                        {profile.apps.teams.sessionStatus === 'signed-in' ? 'Connected' : 'Not signed in'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📱 WhatsApp:</span>
                      <strong style={{ color: profile.apps.whatsapp.sessionStatus === 'signed-in' ? '#10b981' : 'var(--muted)' }}>
                        {profile.apps.whatsapp.sessionStatus === 'signed-in' ? 'Connected' : 'Not signed in'}
                      </strong>
                    </div>
                  </div>

                  {/* Custom Links & Agents Section */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px'
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                        Custom Tabs & AI Agents ({customLinks.length})
                      </span>
                      <button
                        type="button"
                        className="btn ghost btn-sm"
                        style={{ fontSize: '0.78rem', padding: '2px 8px' }}
                        onClick={() =>
                          setAddingLinkForProfileId(
                            addingLinkForProfileId === profile.id ? null : profile.id
                          )
                        }
                      >
                        {addingLinkForProfileId === profile.id ? 'Cancel' : '+ Add custom link'}
                      </button>
                    </div>

                    {/* Quick 1-Click Presets for this card */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {POPULAR_PRESETS.slice(0, 6).map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          className="btn ghost btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.76rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onClick={() => handleAddPresetToProfile(profile.id, preset.name, preset.url)}
                        >
                          <span>{preset.icon}</span> + {preset.name}
                        </button>
                      ))}
                    </div>

                    {/* Inline Form if open */}
                    {addingLinkForProfileId === profile.id && (
                      <div
                        style={{
                          background: 'var(--surface)',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          display: 'flex',
                          gap: '8px',
                          marginBottom: '10px'
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Name (e.g. Claude)"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            fontSize: '0.82rem',
                            background: 'var(--bg-page)',
                            color: 'var(--text)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px'
                          }}
                        />
                        <input
                          type="url"
                          placeholder="https://..."
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                          style={{
                            flex: 2,
                            padding: '6px 8px',
                            fontSize: '0.82rem',
                            background: 'var(--bg-page)',
                            color: 'var(--text)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px'
                          }}
                        />
                        <button
                          type="button"
                          className="btn primary btn-sm"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={async () => {
                            await handleAddPresetToProfile(profile.id, customName, customUrl)
                            setCustomName('')
                            setCustomUrl('')
                            setAddingLinkForProfileId(null)
                          }}
                          disabled={!customName.trim() || !customUrl.trim()}
                        >
                          Add
                        </button>
                      </div>
                    )}

                    {/* Render existing links */}
                    {customLinks.length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                        No custom links added yet. Use the 1-click buttons above to add Claude, ChatGPT or any site.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                        {customLinks.map((link) => (
                          <div
                            key={link.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              background: 'var(--surface)',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              fontSize: '0.8rem'
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                minWidth: 0,
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                onSelectProfile?.(profile.id)
                                onOpenCustomLink?.(profile.id, link)
                                onClose()
                              }}
                              title={`Open ${link.name}`}
                            >
                              <span style={{ fontSize: '0.9rem' }}>🌐</span>
                              <span
                                style={{
                                  fontWeight: 500,
                                  color: 'var(--text)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {link.name}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  color: link.hiddenInSidebar ? 'var(--text-faint)' : 'var(--accent)'
                                }}
                                onClick={() => handleToggleLinkVisibility(profile.id, link)}
                                title={link.hiddenInSidebar ? 'Hidden in sidebar (click to show)' : 'Visible in sidebar (click to hide)'}
                              >
                                {link.hiddenInSidebar ? '🚫' : '👁'}
                              </button>
                              <button
                                type="button"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  color: 'var(--muted)'
                                }}
                                onClick={() => handleRemoveLink(profile.id, link.id)}
                                title="Remove link"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
export default AccountsManagementModal
