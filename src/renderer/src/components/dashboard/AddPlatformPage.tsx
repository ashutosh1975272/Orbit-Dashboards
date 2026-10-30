import { useCallback, useEffect, useState } from 'react'
import { AppId, profileDisplayLabel } from '../../../../shared/types'
import { useProfileStore } from '../../hooks/useProfiles'

interface AddPlatformPageProps {
  open: boolean
  onClose: () => void
  initialProfileId?: string | null
}

interface PlatformEntry {
  id: AppId | 'upwork' | 'discord' | 'google-chat'
  name: string
  icon: string
  status: 'connected' | 'needs-login' | 'soon'
  supported: boolean
  description: string
}

export interface PresetLink {
  name: string
  url: string
  icon: string
  category: 'AI Agents' | 'Productivity & Dev'
}

export const POPULAR_PRESETS: PresetLink[] = [
  { name: 'Claude', url: 'https://claude.ai', icon: '🤖', category: 'AI Agents' },
  { name: 'ChatGPT', url: 'https://chatgpt.com', icon: '✨', category: 'AI Agents' },
  { name: 'Perplexity', url: 'https://perplexity.ai', icon: '🔍', category: 'AI Agents' },
  { name: 'Gemini', url: 'https://gemini.google.com', icon: '💎', category: 'AI Agents' },
  { name: 'GitHub', url: 'https://github.com', icon: '🐙', category: 'Productivity & Dev' },
  { name: 'Notion', url: 'https://notion.so', icon: '📝', category: 'Productivity & Dev' },
  { name: 'Linear', url: 'https://linear.app', icon: '📐', category: 'Productivity & Dev' },
  { name: 'Figma', url: 'https://figma.com', icon: '🎨', category: 'Productivity & Dev' },
  { name: 'Google Drive', url: 'https://drive.google.com', icon: '📁', category: 'Productivity & Dev' }
]

const PLATFORMS: PlatformEntry[] = [
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    status: 'needs-login',
    supported: true,
    description: 'Connect a Slack workspace and map its messages to project cards.'
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    icon: '👥',
    status: 'needs-login',
    supported: true,
    description: 'Connect a Teams workspace and read messages from project cards.'
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: '📱',
    status: 'needs-login',
    supported: true,
    description: 'Read-only WhatsApp Web session for client communication.'
  },
  {
    id: 'upwork',
    name: 'Upwork',
    icon: '💼',
    status: 'soon',
    supported: false,
    description: 'Upwork Messages integration coming soon.'
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    status: 'soon',
    supported: false,
    description: 'Discord server integration coming soon.'
  },
  {
    id: 'google-chat',
    name: 'Google Chat',
    icon: '💭',
    status: 'soon',
    supported: false,
    description: 'Google Chat integration coming soon.'
  }
]

export function AddPlatformPage({ open, onClose, initialProfileId }: AddPlatformPageProps): React.JSX.Element | null {
  const profiles = useProfileStore((s) => s.profiles)
  const activeProfileId = useProfileStore((s) => s.activeProfileId)
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; error?: boolean } | null>(null)
  const [addingPreset, setAddingPreset] = useState<string | null>(null)

  useEffect(() => {
    if (initialProfileId) {
      setSelectedProfileId(initialProfileId)
    } else if (activeProfileId) {
      setSelectedProfileId(activeProfileId)
    } else if (profiles.length > 0 && !selectedProfileId) {
      setSelectedProfileId(profiles[0]!.id)
    }
  }, [initialProfileId, activeProfileId, profiles])

  const handleAddLink = useCallback(
    async (name: string, url: string) => {
      if (!selectedProfileId) {
        setFeedbackMsg({ text: 'Please select a profile first.', error: true })
        return
      }
      setFeedbackMsg(null)
      try {
        const updated = await window.api.profiles.addCustomLink(selectedProfileId, {
          name,
          url
        })
        useProfileStore.setState((prev) => ({
          profiles: prev.profiles.map((p) => (p.id === updated.id ? updated : p))
        }))
        setFeedbackMsg({ text: `Successfully added ${name} to sidebar!`, error: false })
        setCustomName('')
        setCustomUrl('')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        setFeedbackMsg({ text: msg, error: true })
      }
    },
    [selectedProfileId]
  )

  if (!open) return null

  return (
    <div className="add-platform-backdrop" onClick={onClose}>
      <div
        className="add-platform-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add Platform or Custom Links"
      >
        <div className="add-platform-header">
          <div>
            <h2>Add Platform or Web Link</h2>
            <p className="add-section-sub" style={{ margin: '4px 0 0 0' }}>
              Connect native workspaces or add web links to your account.
            </p>
          </div>
          <button
            type="button"
            className="btn ghost btn-sm"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Profile Selector */}
        <div
          style={{
            background: 'var(--bg-page)',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>
              Target Google Email:
            </span>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              style={{
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '0.85rem'
              }}
            >
              {profiles.length === 0 ? (
                <option value="">No profiles added yet</option>
              ) : (
                profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {profileDisplayLabel(p)} ({p.displayName})
                  </option>
                ))
              )}
            </select>
          </div>
          {feedbackMsg && (
            <span
              style={{
                fontSize: '0.82rem',
                color: feedbackMsg.error ? 'var(--danger, #ff5c5c)' : 'var(--accent, #6366f1)',
                fontWeight: 500
              }}
            >
              {feedbackMsg.text}
            </span>
          )}
        </div>

        {/* 1-Click Popular Presets */}
        <section className="add-section">
          <h3 className="add-section-title">Popular AI Agents & Tools (1-Click Add)</h3>
          <p className="add-section-sub">
            Click "+ Add" to instantly bind Claude, ChatGPT, Notion, GitHub and more to this email.
          </p>

          <div className="preset-grid">
            {POPULAR_PRESETS.map((preset) => (
              <div key={preset.name} className="preset-card">
                <div className="preset-meta">
                  <span className="preset-icon">{preset.icon}</span>
                  <div>
                    <div className="preset-name">{preset.name}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn primary btn-sm"
                  style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                  onClick={async () => {
                    setAddingPreset(preset.name)
                    await handleAddLink(preset.name, preset.url)
                    setAddingPreset(null)
                  }}
                  disabled={addingPreset === preset.name}
                >
                  {addingPreset === preset.name ? 'Adding…' : '+ Add'}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Native Workspaces */}
        <section className="add-section">
          <h3 className="add-section-title">Supported Messaging Platforms</h3>
          <div className="add-platform-list">
            {PLATFORMS.map((platform) => {
              const currentProfile = profiles.find((p) => p.id === selectedProfileId)
              const session = currentProfile && platform.id in currentProfile.apps
                ? currentProfile.apps[platform.id as AppId]
                : null
              const isConnected = session?.sessionStatus === 'signed-in'
              const status = isConnected
                ? 'connected'
                : platform.supported
                  ? 'needs-login'
                  : 'soon'

              return (
                <div
                  key={platform.id}
                  className={`add-platform-row${!platform.supported ? ' is-soon' : ''}`}
                >
                  <div className="add-platform-info">
                    <span className="add-platform-icon">{platform.icon}</span>
                    <span className="add-platform-name">{platform.name}</span>
                    <span className="add-platform-desc">{platform.description}</span>
                  </div>
                  <div className="add-platform-status">
                    <span className={`add-platform-status-dot ${status}`} />
                    <span className="add-platform-status-label">
                      {status === 'connected' ? 'Connected' : status === 'soon' ? 'Soon' : 'Needs login'}
                    </span>
                  </div>
                  {platform.supported && !isConnected ? (
                    <button
                      type="button"
                      className="btn primary btn-sm"
                      onClick={() => {
                        onClose()
                      }}
                    >
                      Connect
                    </button>
                  ) : platform.supported && isConnected ? (
                    <button type="button" className="btn ghost btn-sm" disabled>
                      Connected
                    </button>
                  ) : (
                    <span className="add-platform-soon-badge">Soon</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Custom Link Form */}
        <section className="add-section add-section-custom">
          <h3 className="add-section-title">Add Any Custom URL</h3>
          <p className="add-section-sub">
            Add any secure HTTPS web link for embedded viewing. View only — no automation.
          </p>
          <div className="add-custom-form">
            <div className="add-custom-field">
              <label className="add-custom-label">Name</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Claude Workspace, Linear Team, Jira"
                className="add-custom-input"
              />
            </div>
            <div className="add-custom-field">
              <label className="add-custom-label">URL (https only)</label>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://example.com"
                className="add-custom-input"
              />
            </div>
            <button
              type="button"
              className="btn primary btn-sm"
              onClick={() => handleAddLink(customName, customUrl)}
              disabled={!customName.trim() || !customUrl.trim()}
            >
              Add link
            </button>
          </div>
          <p className="add-custom-note">
            View only. Automation aur scraping is link par available nahi. Partition isolated.
          </p>
        </section>
      </div>
    </div>
  )
}
export default AddPlatformPage
