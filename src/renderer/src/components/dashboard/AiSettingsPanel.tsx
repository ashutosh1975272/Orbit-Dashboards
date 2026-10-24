import type React from 'react'
import AiSettingsForm from './AiSettingsForm'

interface AiSettingsPanelProps {
  open: boolean
  onClose: () => void
}

/** Dashboard-level AI settings: the fallback key and model for every project. */
export default function AiSettingsPanel({
  open,
  onClose
}: AiSettingsPanelProps): React.ReactElement | null {
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
        className="settings-panel ai-settings-panel"
        role="dialog"
        aria-label="Dashboard AI settings"
      >
        <header className="settings-header">
          <h2>Dashboard AI settings</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="settings-hint">
          Fallback key and model for every project. A project can override them from its own
          Settings tab, or inherit them with <b>Use global settings</b>.
        </p>
        <AiSettingsForm />
      </div>
    </div>
  )
}
