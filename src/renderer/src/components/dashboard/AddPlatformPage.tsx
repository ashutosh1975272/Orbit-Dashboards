import { useCallback, useEffect, useState } from 'react'
import type { AppId } from '../../../shared/types'
import { appLabel } from '../../../shared/types'
import { useProfileStore } from '../../hooks/useProfiles'

interface AddPlatformPageProps {
  open: boolean
  onClose: () => void
}

interface PlatformEntry {
  id: AppId | 'upwork' | 'discord' | 'google-chat'
  name: string
  icon: string
  status: 'connected' | 'needs-login' | 'soon'
  supported: boolean
  description: string
}

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

function workspaceIcon(teamName: string): string {
  return teamName.trim().charAt(0).toUpperCase()
}

type ProfileAppSession = Record<AppId, { sessionStatus: string; availableWorkspaces: { teamId: string; teamName: string; openUrl: string; teamDomain?: string; lastChannelName?: string }[] }>

export function AddPlatformPage({
  open,
  onClose
}: AddPlatformPageProps): React.JSX.Element | null {
  if (!open) return null

  const profiles = useProfileStore.getState().profiles
  const [workspaces, setWorkspaces] = useState<Array<{
    teamId: string
    teamName: string
    teamDomain?: string
    profileId: string
    appId: AppId
    projectCount: number
  }>>([])
  const [mappings, setMappings] = useState<{ workspaceId: string; projectIds: string[] }[]>([])

  const loadData = useCallback(async () => {
    const allWorkspaces: Array<{
      teamId: string
      teamName: string
      teamDomain?: string
      profileId: string
      appId: AppId
      projectCount: number
    }> = []

    for (const profile of profiles) {
      for (const appId of ['slack', 'teams'] as AppId[]) {
        const session = (profile.apps as ProfileAppSession)[appId]
        if (session?.sessionStatus === 'signed-in') {
          for (const ws of session.availableWorkspaces) {
            allWorkspaces.push({
              teamId: ws.teamId,
              teamName: ws.teamName,
              teamDomain: ws.teamDomain,
              profileId: profile.id,
              appId,
              projectCount: 0
            })
          }
        }
      }
    }

    try {
      const mapList = await window.api.dashboard.listWorkspaceMappings()
      setMappings(mapList)

      const withCounts = allWorkspaces.map((w) => ({
        ...w,
        projectCount: mapList.find((m) => m.workspaceId === w.teamId)?.projectIds.length ?? 0
      }))
      setWorkspaces(withCounts)
    } catch {
      setWorkspaces(allWorkspaces)
    }
  }, [profiles])

  useEffect(() => {
    loadData()
  }, [loadData])

  const platformStatus = (appId: AppId): 'connected' | 'needs-login' | 'signing-in' => {
    const profile = profiles[0]
    if (!profile) return 'needs-login'
    const session = (profile.apps as Record<AppId, { sessionStatus: string }>)[appId]
    if (session?.sessionStatus === 'signed-in') return 'connected'
    if (session?.sessionStatus === 'not-signed-in') return 'needs-login'
    return 'signing-in'
  }

  return (
    <div
      className="add-platform-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="add-platform-panel" role="dialog" aria-modal="true" aria-label="Add platform or custom link">
        <header className="add-platform-header">
          <h2>Add platform</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <section className="add-section">
          <h3 className="add-section-title">Connected workspaces</h3>
          <p className="add-section-sub">
            Workspaces you're already signed into. Click "Map to cards" to link them
            to project cards.
          </p>
          <div className="add-workspace-grid">
            {workspaces.length === 0 ? (
              <p className="add-empty">No connected workspaces yet.</p>
            ) : (
              workspaces.map((ws) => (
                <div
                  key={`${ws.profileId}:${ws.appId}:${ws.teamId}`}
                  className="add-workspace-card"
                >
                  <div className="add-workspace-header">
                    <span className="add-workspace-icon">{workspaceIcon(ws.teamName)}</span>
                    <div className="add-workspace-info">
                      <span className="add-workspace-name">{ws.teamName}</span>
                      {ws.teamDomain && <span className="add-workspace-domain">@{ws.teamDomain}</span>}
                    </div>
                    <span className={`add-workspace-badge ${ws.projectCount > 0 ? 'is-mapped' : 'is-unmapped'}`}>
                      {ws.projectCount > 0 ? `Mapped to ${ws.projectCount} cards` : 'Not mapped'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn primary btn-sm"
                    onClick={() => {
                      onClose()
                    }}
                  >
                    Map to cards
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
        <section className="add-section">
          <h3 className="add-section-title">Available platforms</h3>
          <p className="add-section-sub">
            Connect a new platform or view connection status.
          </p>
          <div className="add-platform-list">
            {PLATFORMS.map((p) => {
              const status = p.id === 'slack' || p.id === 'teams' || p.id === 'whatsapp'
                ? platformStatus(p.id as AppId)
                : p.status
              const isConnected = status === 'connected'
              const isSupported = p.supported
              return (
                <div
                  key={p.id}
                  className={`add-platform-row${isSupported ? '' : ' is-soon'}`}
                >
                  <div className="add-platform-info">
                    <span className="add-platform-icon">{p.icon}</span>
                    <div>
                      <span className="add-platform-name">{p.name}</span>
                      <span className="add-platform-desc">{p.description}</span>
                    </div>
                  </div>
                  <div className="add-platform-status">
                    <span
                      className={`add-platform-status-dot ${status === 'connected' ? 'connected' : status === 'soon' ? 'soon' : 'needs-login'}`}
                    />
                    <span className="add-platform-status-label">
                      {status === 'connected' ? 'Connected' : status === 'soon' ? 'Soon' : 'Needs login'}
                    </span>
                  </div>
                  {isSupported && !isConnected ? (
                    <button
                      type="button"
                      className="btn primary btn-sm"
                      onClick={() => {
                        onClose()
                      }}
                    >
                      Connect
                    </button>
                  ) : isSupported && isConnected ? (
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

        <section className="add-section add-section-custom">
          <h3 className="add-section-title">Custom link</h3>
          <p className="add-section-sub">
            Add any secure web link for embedded viewing. View only — no automation.
          </p>
          <div className="add-custom-form">
            <div className="add-custom-field">
              <label className="add-custom-label">Name</label>
              <input
                type="text"
                placeholder="e.g. Client Portal"
                className="add-custom-input"
              />
            </div>
            <div className="add-custom-field">
              <label className="add-custom-label">URL (https only)</label>
              <input
                type="url"
                placeholder="https://example.com"
                className="add-custom-input"
              />
            </div>
            <button type="button" className="btn primary btn-sm">
              Add link
            </button>
          </div>
          <p className="add-custom-note">
            View only. Automation aur scraping is link par available nahi.
          </p>
        </section>
      </div>
    </div>
  )
}