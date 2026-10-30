import { useEffect, useRef, useState } from 'react'

interface CardLiveSlackEmbedProps {
  profileId: string
  teamId: string
  projectId?: string
}

interface ScrapeEventState {
  channelName?: string
  scrollIndex?: number
  maxScroll?: number
  messageCount?: number
  status?: 'reading' | 'idle' | 'finished'
}

/**
 * Embeds a real, interactive Slack desktop WebContentsView directly
 * inside the project card container. Uses ResizeObserver to automatically
 * sync pixel-exact bounding box with Electron main process on every resize/movement.
 */
export default function CardLiveSlackEmbed({
  profileId,
  teamId,
  projectId: _projectId
}: CardLiveSlackEmbedProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const embedRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [lineVisible, setLineVisible] = useState(true)
  const [scrapeEvent, setScrapeEvent] = useState<ScrapeEventState>({ status: 'idle' })

  // Listen to global settings for showScrapeProgressLine toggle
  useEffect(() => {
    void window.api?.app?.getSettings?.().then((settings) => {
      if (typeof settings?.showScrapeProgressLine === 'boolean') {
        setLineVisible(settings.showScrapeProgressLine)
      }
    })
    const unsub = window.api?.app?.onSettingsChanged?.((settings) => {
      if (typeof settings?.showScrapeProgressLine === 'boolean') {
        setLineVisible(settings.showScrapeProgressLine)
      }
    })
    return () => {
      unsub?.()
    }
  }, [])

  // Listen for live scrape events
  useEffect(() => {
    if (!window.api?.dashboard?.onScrapeEvent) return undefined
    const unsubscribe = window.api.dashboard.onScrapeEvent((event: any) => {
      if (event?.type === 'reading-channel') {
        setScrapeEvent({
          status: 'reading',
          channelName: event.channelName,
          scrollIndex: event.scrollIndex,
          maxScroll: event.maxScroll,
          messageCount: event.messageCount
        })
      } else if (event?.type === 'finished' || event?.type === 'stopped') {
        setScrapeEvent({ status: 'finished' })
        setTimeout(() => setScrapeEvent({ status: 'idle' }), 3000)
      }
    })
    return () => {
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    const el = embedRef.current ?? containerRef.current
    if (!el) return

    let cancelled = false

    const sendBounds = () => {
      if (cancelled) return
      const targetEl = embedRef.current ?? containerRef.current
      if (!targetEl) return
      const rect = targetEl.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        const bounds = {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
        void window.api.profiles.updateCardSlackEmbedBounds(bounds)
      }
    }

    // Initial mount and activation
    const rect = el.getBoundingClientRect()
    const initialBounds = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }

    void window.api.profiles
      .activateCardSlackEmbed({
        profileId,
        teamId,
        bounds: initialBounds
      })
      .then(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to activate CardLiveSlackEmbed', err)
      })

    const ro = new ResizeObserver(() => {
      sendBounds()
    })
    ro.observe(el)

    window.addEventListener('resize', sendBounds)
    window.addEventListener('scroll', sendBounds, true)

    return () => {
      cancelled = true
      ro.disconnect()
      window.removeEventListener('resize', sendBounds)
      window.removeEventListener('scroll', sendBounds, true)
      void window.api.profiles.clearCardSlackEmbed()
    }
  }, [profileId, teamId])

  const isScrapingActive = scrapeEvent.status === 'reading' && lineVisible

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 480,
        flex: 1,
        position: 'relative',
        background: '#1a1d21',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {isScrapingActive && (
        <div
          data-testid="in-card-scrape-bar"
          style={{
            height: 24,
            minHeight: 24,
            maxHeight: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            background: 'linear-gradient(90deg, #1e1026 0%, #15181c 100%)',
            borderBottom: '1px solid rgba(74, 222, 128, 0.25)',
            fontSize: 11,
            color: '#e2e8f0',
            width: '100%',
            boxSizing: 'border-box',
            flexShrink: 0,
            zIndex: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 6px #22c55e',
                flexShrink: 0
              }}
            />
            <span style={{ fontWeight: 600, color: '#4ade80' }}>
              {scrapeEvent.channelName ? `#${scrapeEvent.channelName}` : 'Scraping channels...'}
            </span>
            <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scrapeEvent.scrollIndex && scrapeEvent.maxScroll
                ? ` · scroll ${scrapeEvent.scrollIndex}/${scrapeEvent.maxScroll}`
                : ''}
              {scrapeEvent.messageCount !== undefined
                ? ` · ${scrapeEvent.messageCount} msgs found`
                : ''}
            </span>
          </div>
          <span style={{ fontSize: 10, color: '#64748b', flexShrink: 0, marginLeft: 8 }}>
            Scraping public, private & DMs (1h)
          </span>
        </div>
      )}

      <div
        ref={embedRef}
        style={{
          width: '100%',
          flex: 1,
          position: 'relative',
          background: '#1a1d21',
          overflow: 'hidden'
        }}
      >
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              color: '#94a3b8',
              fontSize: 13,
              background: '#1a1d21'
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                border: '2px solid rgba(255,255,255,0.2)',
                borderTopColor: '#6366f1',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}
            />
            <span>Connecting Live Slack...</span>
          </div>
        )}
      </div>
    </div>
  )
}
