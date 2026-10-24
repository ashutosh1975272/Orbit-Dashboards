import type React from 'react'

interface AiChatTabProps {
  projectName: string
}

/** Placeholder — the project-scoped AI chat lands here later. */
export default function AiChatTab({ projectName }: AiChatTabProps): React.ReactElement {
  return (
    <div className="ws-placeholder">
      <span className="ws-placeholder-icon" aria-hidden="true">
        ✦
      </span>
      <h5>{projectName}</h5>
      <p>
        Ask about this project&apos;s status, requirements, scope and next steps. The AI chat for{' '}
        <strong>{projectName}</strong> is coming in a later step.
      </p>
    </div>
  )
}
