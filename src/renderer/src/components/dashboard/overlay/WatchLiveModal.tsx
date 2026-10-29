import React, { useEffect, useRef, useState } from 'react'
import { AgentCursor } from './AgentCursor'
import { MessageHighlight } from './MessageHighlight'
import { StatusPill } from './StatusPill'

interface WatchLiveModalProps {
  projectId: string
  projectName: string
  isOpen: boolean
  onClose: () => void
}

interface ScrapeEventData {
  type: 'navigate' | 'scroll' | 'highlight' | 'status'
  channelName?: string
  scrollIndex?: number
  maxScroll?: number
  messageCount?: number
  bounds?: { x: number; y: number; width: number; height: number }
  text?: string
}

export const WatchLiveModal: React.FC<WatchLiveModalProps> = ({
  projectId,
  projectName,
  isOpen,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [lastEvent, setLastEvent] = useState<ScrapeEventData | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 100, y: 100 })
  const [highlightBounds, setHighlightBounds] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)
  const [isLiveActive, setIsLiveActive] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    // Subscribe to scrape event stream
    const unsubscribe = window.api.dashboard.onScrapeEvent((event: ScrapeEventData) => {
      setLastEvent(event)
      if (event.bounds) {
        setHighlightBounds(event.bounds)
        setCursorPos({
          x: event.bounds.x + 10,
          y: event.bounds.y + 10
        })
      }
    })

    // Attach reader view to this modal container
    const attachLiveView = async () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      try {
        const res = await window.api.dashboard.startWatchLive({
          projectId,
          bounds: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        })
        if (res.ok) {
          setIsLiveActive(true)
          setErrorMsg(null)
        } else {
          setErrorMsg(res.error || 'Failed to attach live view')
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error starting Watch Live')
      }
    }

    const timer = setTimeout(attachLiveView, 150)

    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        window.api.dashboard.startWatchLive({
          projectId,
          bounds: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      clearTimeout(timer)
      unsubscribe()
      window.removeEventListener('resize', handleResize)
      window.api.dashboard.stopWatchLive().catch(() => {})
      setIsLiveActive(false)
    }
  }, [isOpen, projectId])

  if (!isOpen) return null

  return (
    <div
      className="platform-settings-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ zIndex: 1200 }}
    >
      <div
        className="platform-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Watch Live Scraping Automation"
        style={{
          width: '92vw',
          maxWidth: '1100px',
          height: '84vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          background: '#15171a',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)'
        }}
      >
        {/* Header bar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-subtle)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 8px rgba(34, 197, 94, 0.8)'
              }}
            />
            <div>
              <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text)' }}>
                Watch Live Automation
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                ({projectName})
              </span>
            </div>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.3)'
              }}
            >
              Read-Only Overlay
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Non-Invasive App-Level Layer
            </span>
            <button
              type="button"
              className="btn ghost btn-sm"
              onClick={onClose}
              style={{ padding: '4px 10px', fontSize: '13px' }}
            >
              ✕ Close
            </button>
          </div>
        </header>

        {/* Viewport container where WebContentsView sits */}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            flex: 1,
            background: '#0d0e11',
            overflow: 'hidden'
          }}
        >
          {/* Overlay UI (Agent Cursor, Highlighting, Status Pill) */}
          <StatusPill
            channelName={lastEvent?.channelName}
            scrollIndex={lastEvent?.scrollIndex}
            maxScroll={lastEvent?.maxScroll}
            messageCount={lastEvent?.messageCount}
            text={lastEvent?.text}
          />

          <AgentCursor x={cursorPos.x} y={cursorPos.y} visible={isLiveActive} />
          <MessageHighlight bounds={highlightBounds} visible={isLiveActive} />

          {/* Placeholder if scraper not currently active in this instant */}
          {!isLiveActive && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                textAlign: 'center',
                background: 'rgba(15, 17, 21, 0.85)',
                zIndex: 10
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>🕷️</div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: 'var(--text)' }}>
                {errorMsg || 'Waiting for Scraper to Run…'}
              </h4>
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  maxWidth: '380px',
                  lineHeight: 1.5
                }}
              >
                Click <strong>&quot;🕷 Scrape&quot;</strong> on the workspace row in Settings &gt;
                Sources (or on the project card) to observe real-time message scraping here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
