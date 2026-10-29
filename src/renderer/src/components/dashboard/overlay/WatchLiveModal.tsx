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

    // Brief timeout to let modal render into DOM before querying getBoundingClientRect
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl h-[85vh] bg-[#1a1d21] border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#111315] border-b border-slate-800 select-none">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
              <span>Watch Live Automation</span>
              <span className="text-xs font-normal text-slate-400">({projectName})</span>
            </h3>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Read-Only
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">App-Level Non-Invasive Overlay</span>
            <button
              onClick={onClose}
              className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
            >
              Close
            </button>
          </div>
        </div>

        {/* Viewport container where WebContentsView sits */}
        <div ref={containerRef} className="relative flex-1 bg-black overflow-hidden">
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

          {/* Placeholder / Error message if scraper not currently running */}
          {!isLiveActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-slate-900/60 pointer-events-none">
              <div className="text-3xl mb-2">🕷️</div>
              <h4 className="text-sm font-medium text-slate-200 mb-1">
                {errorMsg || 'Waiting for Scraper to Run…'}
              </h4>
              <p className="text-xs text-slate-400 max-w-sm">
                Click <strong>"Scrape"</strong> on the project card or in Settings &gt; Sources to
                start reading Slack messages live in this view.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

