import type { AppId } from '../../../../shared/types'
import { appLabel } from '../../../../shared/types'
import { useProfileStore } from '../../hooks/useProfiles'

interface PlatformSettingsPanelProps {
  open: boolean
  profileId: string
  appId: AppId
  onClose: () => void
}

function workspaceIcon(teamName: string): string {
  return teamName.trim().charAt(0).toUpperCase()
}

function statusFor(sessionStatus: string): { label: string; kind: 'connected' | 'needs-login' | 'signing-in' } {
  if (sessionStatus === 'signed-in') {
    return { label: 'Connected', kind: 'connected' }
  }
  if (sessionStatus === 'not-signed-in') {
    return { label: 'Needs login', kind: 'needs-login' }
  }
  return { label: 'Signing in…', kind: 'signing-in' }
}

export function PlatformSettingsPanel({
  open,
  profileId,
  appId,
  onClose
}: PlatformSettingsPanelProps): React.JSX.Element | null {
  if (!open) return null

  const profile = useProfileStore.getState().profiles.find((p) => p.id === profileId)
  const session = (profile?.apps as Record<AppId, { sessionStatus: string; availableWorkspaces: { teamId: string; teamName: string; openUrl: string; teamDomain?: string; lastChannelName?: string }[] }>)[appId]
  const availableWorkspaces = session?.availableWorkspaces ?? []
  const platformName = appLabel(appId)

  return (
    <div
      className="platform-settings-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="platform-settings-panel" role="dialog" aria-modal="true" aria-label={`${platformName} settings`}>
        <header className="platform-settings-header">
          <h2>{platformName} settings</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>

        {appId === 'slack' ? (
          <SlackSettingsContent availableWorkspaces={availableWorkspaces} sessionStatus={session?.sessionStatus ?? 'not-signed-in'} />
        ) : (
          <ComingSoonContent platformName={platformName} sessionStatus={session?.sessionStatus ?? 'not-signed-in'} />
        )}
      </div>
    </div>
  )
}

function SlackSettingsContent({
  availableWorkspaces,
  sessionStatus
}: {
  availableWorkspaces: { teamId: string; teamName: string; openUrl: string; teamDomain?: string; lastChannelName?: string }[]
  sessionStatus: string
}): React.JSX.Element {
  const { label, kind } = statusFor(sessionStatus)

  return (
    <section className="slack-settings-section">
      <div className="slack-settings-header-row">
        <span className="slack-settings-label">Connected workspaces</span>
        <button type="button" className="btn ghost btn-sm" title="Refresh workspace list">
          ⟳
        </button>
      </div>
      <p className="slack-settings-status">
        <span
          className={`status-dot status-dot-${kind}`}
          aria-label={label}
          title={label}
        />
        {label}
      </p>

      {availableWorkspaces.length === 0 ? (
        <p className="slack-settings-empty">No connected workspaces yet. Sign in to Slack to see workspaces here.</p>
      ) : (
        <ul className="slack-settings-workspace-list">
          {availableWorkspaces.map((ws) => (
            <li key={ws.teamId} className="slack-settings-workspace-row">
              <span className="slack-settings-workspace-icon">{workspaceIcon(ws.teamName)}</span>
              <span className="slack-settings-workspace-name">{ws.teamName}</span>
              {ws.teamDomain && (
                <span className="slack-settings-workspace-domain">@{ws.teamDomain}</span>
              )}
              <span className="slack-settings-workspace-badge">Not mapped</span>
            </li>
          ))}
        </ul>
      )}

      <p className="slack-settings-note">
        Agent in workspaces/channels ke saare messages padhega. Mapping project cards se
        Phase 3 mein jodegi.
      </p>
    </section>
  )
}

function ComingSoonContent({
  platformName,
  sessionStatus
}: {
  platformName: string
  sessionStatus: string
}): React.JSX.Element {
  const { label, kind } = statusFor(sessionStatus)

  return (
    <section className="platform-settings-coming-soon">
      <p className="platform-settings-status">
        <span
          className={`status-dot status-dot-${kind}`}
          aria-label={label}
          title={label}
        />
        {label}
      </p>
      <div className="platform-settings-soon-badge">Soon</div>
      <p className="platform-settings-soon-note">
        {platformName} settings panel is coming soon. Connected account and workspace
        mapping will be available in a future update.
      </p>
    </section>
  )
}