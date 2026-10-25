import type React from 'react'
import type { XomniModeKey } from './workspace-nav'

interface AgentChatPanelProps {
  projectName: string
  projectId: string
  /** Which Xomni mode is active — chosen from the sidebar's Xomni section. */
  mode: XomniModeKey
}

/** Xomni — the project assistant. Phase A ships the shell: the mode buttons
 * and Schedules live in the sidebar's Xomni section ("Chat with project" is
 * real from Phase B; "Talk to AgentWork" unlocks with the MCP bridge in
 * Phase D; Schedules waits for Phase E). */
export default function AgentChatPanel({ projectName, mode }: AgentChatPanelProps): React.ReactElement {
  return (
    <div className="ws-agent">
      {mode === 'agentwork' ? (
        <div className="ws-agent-empty">
          <p className="ws-agent-empty-title">AgentWork is not connected yet</p>
          <p className="ws-agent-empty-hint">
            Add the AgentWork MCP server in Settings to talk to your agent from here.
          </p>
        </div>
      ) : (
        <div className="ws-agent-empty">
          <p className="ws-agent-empty-title">Ask {projectName} anything</p>
          <p className="ws-agent-empty-hint">
            The agent answers from this project&apos;s insight and recent Slack messages.
          </p>
        </div>
      )}
    </div>
  )
}
