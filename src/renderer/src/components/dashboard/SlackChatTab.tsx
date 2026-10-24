import type React from 'react'

interface SlackChatTabProps {
  projectName: string
}

/** Placeholder — the live Slack conversation for this project lands here later. */
export default function SlackChatTab({ projectName }: SlackChatTabProps): React.ReactElement {
  return (
    <div className="ws-placeholder">
      <span className="ws-placeholder-icon" aria-hidden="true">
        #
      </span>
      <h5>Slack Chat</h5>
      <p>
        The live conversation for <strong>{projectName}</strong> will appear here. Messages stay
        read-only in Orbit — replies go through the Slack workspace view.
      </p>
    </div>
  )
}
