import { useEffect, useState } from 'react'
import type { DashboardProject } from '../../../shared/dashboard-contract'

export interface SlackChannelListing {
  loading: boolean
  error: string | null
  channels: Array<{ id: string; name: string }>
}

const EMPTY: SlackChannelListing = { loading: false, error: null, channels: [] }
const LOADING: SlackChannelListing = { loading: true, error: null, channels: [] }

/** The last settled listing, tagged with the project it was fetched for. The
 * tag is what lets the hook tell "this card's list" from "the previous card's
 * list" during render, without writing state before the fetch settles. */
interface SettledListing extends SlackChannelListing {
  projectId: string | null
}

const UNSETTLED: SettledListing = { projectId: null, ...EMPTY }

/** Every channel the card's own Slack token can reach, listed once the first
 * card that shows the Channels section asks for it. A failure stays a failure:
 * the dropdown shows the reason rather than an empty list that would read as
 * "no channels". While a fetch is in flight, or right after the card changed,
 * the listing reads as loading so one card never shows another card's channels. */
export function useSlackChannels(project: DashboardProject | null): SlackChannelListing {
  const [settled, setSettled] = useState<SettledListing>(UNSETTLED)
  const projectId = project?.id ?? null
  // Depend on the token's identity, not the object: a caller that rebuilds the
  // project object each render must not restart the listing.
  const tokenSource = project?.tokenSource ?? 'oauth'
  const profileId = project?.profileId
  const teamId = project?.teamId
  const manualTokenKey = project?.manualTokenKey

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    window.api.dashboard
      .listChannels({ tokenSource, profileId, teamId, manualTokenKey })
      .then((channels) => {
        if (cancelled) return
        setSettled({
          projectId,
          loading: false,
          error: null,
          channels: channels.map((c) => ({ id: c.id, name: c.name }))
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setSettled({
          projectId,
          loading: false,
          error: err instanceof Error ? err.message : 'Could not list the channels.',
          channels: []
        })
      })
    return () => {
      cancelled = true
    }
  }, [projectId, tokenSource, profileId, teamId, manualTokenKey])

  if (!projectId) return EMPTY
  if (settled.projectId !== projectId) return LOADING
  return { loading: settled.loading, error: settled.error, channels: settled.channels }
}
