import { useEffect, useRef, useState } from 'react'

interface CardLiveSlackEmbedProps {
  profileId: string
  teamId: string
}

/**
 * Embeds a real, interactive Slack desktop WebContentsView directly
 * inside the project card container. Uses ResizeObserver to automatically
 * sync pixel-exact bounding box with Electron main process on every resize/movement.
 */
export default function CardLiveSlackEmbed({
  profileId,
  teamId
}: CardLiveSlackEmbedProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false

    const sendBounds = () => {
      if (cancelled || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
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
  )
}

