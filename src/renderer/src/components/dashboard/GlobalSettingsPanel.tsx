import type React from 'react'
import AiSettingsForm from './AiSettingsForm'
import TeamSlackSettings from './TeamSlackSettings'

interface GlobalSettingsPanelProps {
  open: boolean
  onClose: () => void
}

/**
 * The dashboard's one settings surface: values that apply to every card unless
 * the card overrides them. Sections are stacked here as the groups land.
 */
export default function GlobalSettingsPanel({
  open,
  onClose
}: GlobalSettingsPanelProps): React.ReactElement | null {
  if (!open) return null

  return (
    <div
      className="settings-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="settings-panel global-settings-panel"
        role="dialog"
        aria-label="Global settings"
      >
        <header className="settings-header">
          <h2>Global settings</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="settings-hint">
          Set once for every card. A card that overrides a value keeps its own, and says which
          source is in effect.
        </p>

        <section className="ws-settings-section global-settings-section">
          <div className="ws-settings-head">
            <h4>Our team Slack</h4>
            <p>
              One workspace for your own team, connected once. Its pinned channels are added to
              every card next to that card&apos;s client channels.
            </p>
          </div>
          <TeamSlackSettings />
        </section>

        <section className="ws-settings-section global-settings-section">
          <div className="ws-settings-head">
            <h4>AI model and key</h4>
            <p>
              The fallback key and model for every project. A project overrides them from its own
              Settings tab, or inherits them with <b>Use global settings</b>.
            </p>
          </div>
          <AiSettingsForm />
        </section>
      </div>
    </div>
  )
}
