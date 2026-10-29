import { useEffect, useRef, useState } from 'react'
import { boundsEqual, createRafThrottle } from '../lib/perf'
import { LiveSessionBorder, type BorderState } from './dashboard/overlay/LiveSessionBorder'
import { useDashboardStore } from '../hooks/useDashboard'

interface SlackViewportProps {
  hasActiveProfile: boolean
  onBoundsChange: (bounds: { x: number; y: number; width: number; height: number }) => void
}

export function SlackViewport({
  hasActiveProfile,
  onBoundsChange
}: SlackViewportProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  const [scrapeState, setScrapeState] = useState<BorderState>('idle')
  const [statusText, setStatusText] = useState<string>('')
  const [snippets, setSnippets] = useState<Array<{ sender: string; snippet: string; channelName?: string; ts: string }>>([])
  const openDashboard = useDashboardStore((s) => s.openDashboard)

  useEffect(() => {
    // Listen to real-time scrape events for dynamic border and live control strip
    if (!window.api?.dashboard?.onScrapeEvent) {
      return
    }
    const unsubscribe = window.api.dashboard.onScrapeEvent((event: any) => {
      if (event.type === 'navigate' || event.type === 'status' || event.type === 'read') {
        setScrapeState('reading')
        if (event.text) setStatusText(event.text)
        if (event.snippet) {
          setSnippets((prev) => [
            ...prev,
            {
              sender: event.sender || 'Anonymous',
              snippet: event.snippet,
              channelName: event.channelName,
              ts: event.timestamp || new Date().toISOString()
            }
          ])
        }
      } else if (event.type === 'waiting_for_user') {
        setScrapeState('waiting_for_user')
        setStatusText('User active in Slack — Reader paused')
      } else if (event.type === 'paused') {
        setScrapeState('paused')
        setStatusText('Automation paused')
      } else if (event.type === 'challenge' || event.type === 'adapter_broken' || event.type === 'error') {
        setScrapeState('challenge')
        setStatusText(event.text || 'Action required')
      } else if (event.type === 'run_finished') {
        setTimeout(() => {
          setScrapeState('idle')
          setStatusText('')
        }, 4000)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }

    const publish = createRafThrottle(
      (bounds: { x: number; y: number; width: number; height: number }) => {
        if (boundsEqual(last.current, bounds)) return
        last.current = bounds
        onBoundsChange(bounds)
      }
    )

    const report = (): void => {
      const rect = el.getBoundingClientRect()
      publish({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      })
    }

    report()
    const observer = new ResizeObserver(report)
    observer.observe(el)
    window.addEventListener('resize', report)

    return () => {
      publish.cancel()
      observer.disconnect()
      window.removeEventListener('resize', report)
    }
  }, [onBoundsChange])

  return (
    <div className="slack-viewport" ref={ref} data-testid="slack-viewport" style={{ position: 'relative' }}>
      <LiveSessionBorder
        state={scrapeState}
        visible={scrapeState !== 'idle'}
        borderStyle="glow"
        statusText={statusText}
        snippets={snippets}
        onPause={() => setScrapeState('paused')}
        onResume={() => setScrapeState('reading')}
        onStop={() => {
          setScrapeState('idle')
          setStatusText('')
        }}
        onBackToDashboard={openDashboard}
      />
      {!hasActiveProfile ? (
        <div className="viewport-placeholder">
          <h1>Embed</h1>
          <p>Select Slack, Teams, or WhatsApp under a profile.</p>
        </div>
      ) : null}
    </div>
  )
}
