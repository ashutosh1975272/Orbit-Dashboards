import type React from 'react'
import { useEffect, useState } from 'react'
import type {
  DashboardTeamWorkspace,
  DashboardTeamWorkspaceCandidate
} from '../../../../shared/dashboard-contract'

type Monitor = DashboardTeamWorkspace['channels'][number]

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

const SOURCE_LABEL: Record<DashboardTeamWorkspace['source'], string> = {
  oauth: 'Connected account',
  manual: 'Pasted token',
  none: 'Not connected'
}

/**
 * The one team workspace shared by every card (ticket 04). Connecting is done
 * once here; every card then reads its pinned channels. The token is verified
 * and stored by main — this form only ever sees a mask.
 */
export default function TeamSlackSettings(): React.ReactElement {
  const [workspace, setWorkspace] = useState<DashboardTeamWorkspace | null>(null)
  const [candidates, setCandidates] = useState<DashboardTeamWorkspaceCandidate[]>([])
  const [available, setAvailable] = useState<Array<{ id: string; name: string }> | null>(null)
  const [pinned, setPinned] = useState<string[]>([])
  const [choice, setChoice] = useState('')
  const [manualToken, setManualToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [current, list] = await Promise.all([
          window.api.dashboard.getTeamWorkspace(),
          window.api.dashboard.listTeamWorkspaceCandidates()
        ])
        if (cancelled) return
        setWorkspace(current)
        setCandidates(list)
        setPinned(current.channels.map((c) => c.channelId))
      } catch (err) {
        if (!cancelled) setError(errorText(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Once connected, ask Slack for every channel this token can see so the
  // pinning list is accurate rather than only the channels pinned so far.
  useEffect(() => {
    if (!workspace?.connected) return
    let cancelled = false
    void (async () => {
      try {
        const channels = await window.api.dashboard.listChannels({ source: 'ours' })
        if (cancelled) return
        setAvailable(channels.map((c) => ({ id: c.id, name: c.name })))
      } catch (err) {
        if (!cancelled) setError(errorText(err))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [workspace?.connected, workspace?.teamId, workspace?.updatedAt])

  async function connect(): Promise<void> {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const selected = candidates.find((c) => c.teamId === choice)
      const next =
        selected !== undefined
          ? await window.api.dashboard.connectTeamWorkspace({
              source: 'oauth',
              profileId: selected.profileId,
              teamId: selected.teamId
            })
          : await window.api.dashboard.connectTeamWorkspace({
              source: 'manual',
              token: manualToken.trim()
            })
      setWorkspace(next)
      setPinned(next.channels.map((c) => c.channelId))
      setManualToken('')
      setNotice('Connected. Pick the channels this workspace should add to every card.')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function savePins(channels: Monitor[]): Promise<void> {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const next = await window.api.dashboard.setTeamWorkspaceChannels({ channels })
      setWorkspace(next)
      setPinned(next.channels.map((c) => c.channelId))
      setNotice(
        next.channels.length === 0
          ? 'Saved. No channels pinned, so cards read only their client workspace.'
          : `Saved. ${next.channels.length} channel${next.channels.length === 1 ? '' : 's'} added to every card.`
      )
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  function togglePinned(id: string): void {
    if (!available) return
    const nextIds = pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id]
    const byId = new Map<string, Monitor>()
    for (const channel of workspace?.channels ?? []) byId.set(channel.channelId, channel)
    for (const channel of available) {
      if (!byId.has(channel.id))
        byId.set(channel.id, { channelId: channel.id, channelName: channel.name })
    }
    for (const id of nextIds) {
      if (!byId.has(id)) byId.set(id, { channelId: id, channelName: id })
    }
    const channels = nextIds.map((id) => byId.get(id)).filter((c): c is Monitor => c !== undefined)
    setPinned(nextIds)
    void savePins(channels)
  }

  async function disconnect(): Promise<void> {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const next = await window.api.dashboard.clearTeamWorkspace()
      setWorkspace(next)
      setAvailable(null)
      setPinned([])
      setNotice('Disconnected. Cards keep the messages already stored.')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="ai-settings-hint">Checking our team workspace…</p>
  }

  return (
    <div className="ai-settings">
      {workspace?.connected ? (
        <>
          <div className="ai-settings-effective">
            <span className="ai-settings-label">Connected</span>
            <b>{workspace.teamName ?? workspace.teamId}</b>
            <span className="ai-settings-hint">
              {SOURCE_LABEL[workspace.source]}
              {workspace.maskedToken ? ` ${workspace.maskedToken}` : ''}
            </span>
          </div>

          <div className="ai-settings-field">
            <span>Channels on every card</span>
            {available === null ? (
              <small className="ai-settings-hint">Loading channels…</small>
            ) : available.length === 0 ? (
              <small className="ai-settings-hint">This token cannot see any channels.</small>
            ) : (
              <div className="ai-settings-channel-list">
                {available.map((channel) => (
                  <label className="ai-settings-toggle" key={channel.id}>
                    <input
                      type="checkbox"
                      checked={pinned.includes(channel.id)}
                      disabled={busy}
                      onChange={() => togglePinned(channel.id)}
                    />
                    <span>
                      <b>#{channel.name}</b>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="ai-settings-actions">
            <button
              type="button"
              className="dash-subtle"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {busy ? 'Working…' : 'Disconnect our workspace'}
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="ai-settings-field">
            <span>Use a workspace already connected to this app</span>
            <select
              value={choice}
              disabled={busy || candidates.length === 0}
              onChange={(e) => {
                setChoice(e.target.value)
                setNotice(null)
              }}
            >
              <option value="">
                {candidates.length === 0
                  ? 'None connected yet — paste a token below'
                  : 'Pick a workspace'}
              </option>
              {candidates.map((candidate) => (
                <option key={candidate.teamId} value={candidate.teamId}>
                  {candidate.teamName} · {candidate.profileName}
                </option>
              ))}
            </select>
          </label>

          <label className="ai-settings-field">
            <span>Or paste a Slack token</span>
            <input
              type="password"
              value={manualToken}
              disabled={busy || choice !== ''}
              placeholder="xoxp-… / xoxb-…"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setManualToken(e.target.value)}
            />
            <small className="ai-settings-hint">
              The token is verified with Slack, encrypted in the main process with the OS keychain,
              and never sent back to this window.
            </small>
          </label>

          <div className="ai-settings-actions">
            <button
              type="button"
              className="dash-primary"
              disabled={busy || (choice === '' && manualToken.trim() === '')}
              onClick={() => void connect()}
            >
              {busy ? 'Connecting…' : 'Connect our workspace'}
            </button>
          </div>
        </>
      )}

      {error ? <p className="ai-settings-error">{error}</p> : null}
      {notice ? <p className="ai-settings-notice">{notice}</p> : null}

      <p className="ai-settings-hint">
        Every card reads its own client workspace plus the channels pinned here. Nothing is shared
        between cards, and disconnecting never deletes messages already stored.
      </p>
    </div>
  )
}
