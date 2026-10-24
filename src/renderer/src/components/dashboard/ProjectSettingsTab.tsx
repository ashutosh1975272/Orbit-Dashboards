import type React from 'react'

interface ProjectSettingsTabProps {
  projectName: string
}

/** Placeholder — per-project settings land here later. */
export default function ProjectSettingsTab({
  projectName
}: ProjectSettingsTabProps): React.ReactElement {
  return (
    <div className="ws-placeholder">
      <span className="ws-placeholder-icon" aria-hidden="true">
        ⚙
      </span>
      <h5>Settings</h5>
      <p>
        Workspace, channels and sync options for <strong>{projectName}</strong> will live here. For
        now use the gear in the card header.
      </p>
    </div>
  )
}
