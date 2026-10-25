import { useEffect, useRef, useState } from 'react'
import type { DashboardProject } from '../../../shared/dashboard-contract'

export interface SlackChannelListing {
  loading: boolean
  error: string | null
  channels: Array<{ id: string; name: string }>
}

const EMPTY: SlackChannelListing = { loading: false, error: null, channels: [] }

/** Every channel the card's own Slack token can reach, listed once the first
 * card that shows the Channels section asks for it. A failure stays a failure:
 * the dropdown shows the reason rather than an empty list that would read as
 * "no channels". */
export function useSlackChannels(project: DashboardProject | null): SlackChannelListing {
  const [state, setState] = useState<SlackChannelListing>(EMPTY)
  const requested = useRef<string | null>(null)

  useEffect(() => {
    if (!project) {
      requested.current = null
      setState(EMPTY)
      return
    }
    if (requested.current === project.id) return
    requested.current = project.id
    setState({ loading: true, error: null, channels: [] })
    let cancelled = false
    window.api.dashboard
      .listChannels({
        tokenSource: project.tokenSource,
        profileId: project.profileId,
        teamId: project.teamId,
        manualTokenKey: project.manualTokenKey
      })
      .then((channels) => {
        if (cancelled) return
        setState({
          loading: false,
          error: null,
          channels: channels.map((c) => ({ id: c.id, name: c.name }))
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        requested.current = null
        setState({
          loading: false,
          error: err instanceof Error ? err.message : 'Could not list the channels.',
          channels: []
        })
      })
    return () => {
      cancelled = true
    }
  }, [project])

  return state
}
