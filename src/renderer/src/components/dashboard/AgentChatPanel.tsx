import React, { useCallback, useEffect, useRef, useState } from 'react'
import type {
  DashboardProjectChatErrorCode,
  DashboardProjectChatMessage,
  DashboardProjectChatSourceRef,
  DashboardProjectChatStatus
} from '../../../../shared/dashboard-contract'
import ChatMarkdown from './ChatMarkdown'
import type { XomniModeKey } from './workspace-nav'

interface AgentChatPanelProps {
  projectName: string
  projectId: string
  mode: XomniModeKey
  /** Question handed over from the Dashboard's "Ask agent" bar. */
  initialQuestion?: string | null
  onConsumeInitial?: () => void
  onOpenSettings?: () => void
  onOpenSource?: (ref: DashboardProjectChatSourceRef) => void
}

type RetryMode = 'append' | 'retry' | 'none'

interface ChatFailure {
  message: string
  retryable: boolean
  mode: RetryMode
  question: string
}

const SUGGESTIONS = [
  'What changed this week?',
  'What is the client waiting on?',
  'Any blockers or risks?',
  'Summarise the latest decisions.'
]

const MAX_COMPOSER_HEIGHT = 120

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function timeLabel(iso: string): string {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function sourceLabel(source: DashboardProjectChatSourceRef['source']): string {
  return source === 'ours' ? 'Our Slack' : 'Client Slack'
}

function modelSourceLabel(source: DashboardProjectChatStatus['modelSource']): string {
  if (source === 'project') return 'Custom'
  if (source === 'global') return 'Global'
  return 'Default'
}

function retryableCode(code: DashboardProjectChatErrorCode): boolean {
  return (
    code === 'RATE_LIMITED' || code === 'NETWORK' || code === 'INTERNAL' || code === 'CANCELLED'
  )
}

function dropOptimisticUser(
  messages: DashboardProjectChatMessage[],
  text: string
): DashboardProjectChatMessage[] {
  const last = messages.at(-1)
  return last && last.role === 'user' && last.content === text ? messages.slice(0, -1) : messages
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(area)
      return copied
    } catch {
      return false
    }
  }
}

export default function AgentChatPanel({
  projectName,
  projectId,
  mode,
  initialQuestion,
  onConsumeInitial,
  onOpenSettings,
  onOpenSource
}: AgentChatPanelProps): React.ReactElement {
  const [messages, setMessages] = useState<DashboardProjectChatMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [status, setStatus] = useState<DashboardProjectChatStatus | null>(null)
  const [draft, setDraft] = useState<string>(() => initialQuestion ?? '')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [stopping, setStopping] = useState(false)
  const [failure, setFailure] = useState<ChatFailure | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [showJump, setShowJump] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const runIdRef = useRef<string | null>(null)
  const completedRef = useRef<Set<string>>(new Set())
  const lastQuestionRef = useRef('')
  const stickRef = useRef(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const composingRef = useRef(false)

  const keyMissing = status !== null && !status.hasKey

  const scrollToBottom = useCallback((smooth: boolean): void => {
    const element = scrollRef.current
    if (!element) return
    const behavior = smooth && !prefersReducedMotion() ? 'smooth' : 'auto'
    try {
      element.scrollTo({ top: element.scrollHeight, behavior })
    } catch {
      element.scrollTop = element.scrollHeight
    }
  }, [])

  const handleScroll = useCallback((): void => {
    const element = scrollRef.current
    if (!element) return
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight
    const nearBottom = distance < 48
    stickRef.current = nearBottom
    setShowJump(!nearBottom)
  }, [])

  const jumpToLatest = useCallback((): void => {
    stickRef.current = true
    setShowJump(false)
    scrollToBottom(true)
  }, [scrollToBottom])

  // The model chip and the key banner both land on the card's AI section.
  const openModelSettings = useCallback((): void => {
    try {
      window.history.replaceState(null, '', '#project-ai-settings')
    } catch {
      /* file:// history is best-effort */
    }
    onOpenSettings?.()
  }, [onOpenSettings])

  // ---- history + status -------------------------------------------------
  useEffect(() => {
    let cancelled = false
    void window.api.dashboard
      .getProjectChatHistory(projectId)
      .then((result) => {
        if (cancelled) return
        setMessages(result.messages)
        stickRef.current = true
        requestAnimationFrame(() => scrollToBottom(false))
      })
      .catch(() => {
        if (!cancelled) {
          setFailure({
            message: 'Could not load this conversation. Try again in a moment.',
            retryable: false,
            mode: 'none',
            question: ''
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId, scrollToBottom])

  const refreshStatus = useCallback((): void => {
    void window.api.dashboard
      .getProjectChatStatus(projectId)
      .then((next) => setStatus(next))
      .catch(() => undefined)
  }, [projectId])

  useEffect(() => {
    refreshStatus()
    return window.api.dashboard.onConfigChanged(() => refreshStatus())
  }, [refreshStatus])

  // ---- stream subscriptions --------------------------------------------
  const onChunk = useCallback(
    (event: { projectId: string; runId: string; chunk: string }): void => {
      if (event.projectId !== projectId) return
      if (runIdRef.current && event.runId !== runIdRef.current) return
      if (completedRef.current.has(event.runId)) return
      setStreamText((previous) => previous + event.chunk)
    },
    [projectId]
  )

  const onDone = useCallback(
    (event: {
      projectId: string
      runId: string
      content: string
      sources: DashboardProjectChatSourceRef[]
      stopped: boolean
    }): void => {
      if (event.projectId !== projectId) return
      if (runIdRef.current && event.runId !== runIdRef.current) return
      completedRef.current.add(event.runId)
      runIdRef.current = null
      setStreaming(false)
      setStopping(false)
      setStreamText('')
      setFailure(null)
      if (event.content.trim()) {
        setMessages((previous) => [
          ...previous,
          {
            role: 'assistant',
            content: event.content,
            atIso: new Date().toISOString(),
            sources: event.sources,
            ...(event.stopped ? { stopped: true } : {})
          }
        ])
      } else if (event.stopped) {
        setNotice('Stopped before an answer was written.')
      }
    },
    [projectId]
  )

  const onError = useCallback(
    (event: {
      projectId: string
      runId: string
      code: DashboardProjectChatErrorCode
      error: string
      retryable: boolean
    }): void => {
      if (event.projectId !== projectId) return
      if (runIdRef.current && event.runId !== runIdRef.current) return
      completedRef.current.add(event.runId)
      runIdRef.current = null
      setStreaming(false)
      setStopping(false)
      setStreamText('')
      setFailure({
        message: event.error,
        retryable: event.retryable,
        mode: 'retry',
        question: lastQuestionRef.current
      })
      if (event.code === 'AI_KEY_MISSING') refreshStatus()
    },
    [projectId, refreshStatus]
  )

  useEffect(() => {
    const api = window.api.dashboard
    const offs = [
      api.onProjectChatChunk(onChunk),
      api.onProjectChatDone(onDone),
      api.onProjectChatError(onError)
    ]
    return () => offs.forEach((off) => off())
  }, [onChunk, onDone, onError])

  // ---- scrolling --------------------------------------------------------
  useEffect(() => {
    if (!stickRef.current) return
    scrollToBottom(!streaming)
  }, [messages, streamText, streaming, scrollToBottom])

  useEffect(() => {
    const element = composerRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_COMPOSER_HEIGHT)}px`
  }, [draft])

  useEffect(() => {
    if (!initialQuestion) return
    onConsumeInitial?.()
    requestAnimationFrame(() => {
      composerRef.current?.focus()
      composerRef.current?.select()
    })
  }, [initialQuestion, onConsumeInitial])

  // ---- sending ----------------------------------------------------------
  const send = useCallback(
    async (textOverride?: string): Promise<void> => {
      const text = (textOverride ?? draft).trim()
      if (!text || streaming || keyMissing) return
      lastQuestionRef.current = text
      setDraft('')
      setFailure(null)
      setNotice(null)
      setStreamText('')
      setStopping(false)
      setStreaming(true)
      stickRef.current = true
      setMessages((previous) => [
        ...previous,
        { role: 'user', content: text, atIso: new Date().toISOString() }
      ])
      try {
        const result = await window.api.dashboard.projectChat({ projectId, message: text })
        if (!result.ok) {
          setStreaming(false)
          setMessages((previous) => dropOptimisticUser(previous, text))
          setFailure({
            message: result.error,
            retryable: retryableCode(result.code),
            mode: 'append',
            question: text
          })
          if (result.code === 'AI_KEY_MISSING') refreshStatus()
          return
        }
        if (completedRef.current.has(result.runId)) {
          runIdRef.current = null
          setStreaming(false)
          return
        }
        runIdRef.current = result.runId
      } catch (err) {
        setStreaming(false)
        setMessages((previous) => dropOptimisticUser(previous, text))
        setFailure({
          message: err instanceof Error ? err.message : 'Chat failed. Try again in a moment.',
          retryable: true,
          mode: 'append',
          question: text
        })
      }
    },
    [draft, streaming, keyMissing, projectId, refreshStatus]
  )

  const stop = useCallback(async (): Promise<void> => {
    if (!streaming) return
    setStopping(true)
    try {
      const result = await window.api.dashboard.cancelProjectChat({
        projectId,
        runId: runIdRef.current ?? undefined
      })
      if (!result.ok) {
        // The run had already finished; the done event may have been missed.
        setStopping(false)
        setStreaming(false)
        setStreamText('')
        void window.api.dashboard.getProjectChatHistory(projectId).then((history) => {
          setMessages(history.messages)
        })
      }
    } catch {
      setStopping(false)
    }
  }, [streaming, projectId])

  const retry = useCallback(async (): Promise<void> => {
    if (!failure || !failure.retryable || failure.mode === 'none' || streaming) return
    const { question, mode: retryMode } = failure
    lastQuestionRef.current = question
    setFailure(null)
    setNotice(null)
    setStreamText('')
    setStopping(false)
    setStreaming(true)
    stickRef.current = true
    if (retryMode === 'append') {
      setMessages((previous) => [
        ...previous,
        { role: 'user', content: question, atIso: new Date().toISOString() }
      ])
    }
    try {
      const result = await window.api.dashboard.projectChat({
        projectId,
        message: question,
        retry: retryMode === 'retry'
      })
      if (!result.ok) {
        setStreaming(false)
        if (retryMode === 'append')
          setMessages((previous) => dropOptimisticUser(previous, question))
        setFailure({
          message: result.error,
          retryable: retryableCode(result.code),
          mode: 'append',
          question
        })
        return
      }
      if (completedRef.current.has(result.runId)) {
        runIdRef.current = null
        setStreaming(false)
        return
      }
      runIdRef.current = result.runId
    } catch (err) {
      setStreaming(false)
      setFailure({
        message: err instanceof Error ? err.message : 'Chat failed. Try again in a moment.',
        retryable: true,
        mode: 'append',
        question
      })
    }
  }, [failure, streaming, projectId])

  const clearChat = useCallback(async (): Promise<void> => {
    if (streaming) return
    setConfirmClear(false)
    try {
      await window.api.dashboard.clearProjectChat(projectId)
      setMessages([])
      setFailure(null)
      setNotice(null)
      setStreamText('')
      stickRef.current = true
    } catch {
      setFailure({
        message: 'Could not clear this conversation. Try again in a moment.',
        retryable: true,
        mode: 'none',
        question: ''
      })
    }
  }, [streaming, projectId])

  const applySuggestion = useCallback(
    (text: string): void => {
      if (keyMissing) {
        onOpenSettings?.()
        return
      }
      setDraft(text)
      requestAnimationFrame(() => composerRef.current?.focus())
    },
    [keyMissing, onOpenSettings]
  )

  const copyMessage = useCallback(async (key: string, text: string): Promise<void> => {
    const ok = await copyText(text)
    if (!ok) return
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1400)
  }, [])

  const handleComposerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      if (event.key !== 'Enter' || event.shiftKey) return
      if (composingRef.current || event.nativeEvent.isComposing) return
      event.preventDefault()
      void send()
    },
    [send]
  )

  if (mode === 'agentwork') {
    return (
      <div className="ws-agent-empty">
        <p className="ws-agent-empty-title">AgentWork is not connected yet</p>
        <p className="ws-agent-empty-hint">Add the AgentWork MCP server in Settings.</p>
      </div>
    )
  }

  const liveMessage = failure
    ? 'Chat error'
    : streaming
      ? streamText
        ? 'Answer streaming'
        : 'Thinking'
      : stopping
        ? 'Stopping'
        : ''

  const canSend = !streaming && !keyMissing && draft.trim().length > 0

  return (
    <section className="chat-panel" aria-label={`Chat with ${projectName}`}>
      <header className="chat-head">
        <div className="chat-head-main">
          <h3 className="chat-head-title">Chat with project</h3>
          <span className="chat-head-sub">Answers come only from this card’s stored context.</span>
        </div>
        <div className="chat-head-actions">
          {status ? (
            status.hasKey ? (
              <button
                type="button"
                className="chat-model-chip"
                data-testid="chat-model-chip"
                data-model-source={status.modelSource}
                aria-label={`Model ${status.model}, ${modelSourceLabel(status.modelSource)}. Open AI settings.`}
                title={`Model: ${status.model} (${modelSourceLabel(status.modelSource)}). Key: ${status.keySource}. Open AI settings.`}
                onClick={openModelSettings}
              >
                <span className="chat-model-name">{status.model}</span>
                <span className={`chat-model-source is-${status.modelSource}`}>
                  {modelSourceLabel(status.modelSource)}
                </span>
              </button>
            ) : (
              <button
                type="button"
                className="chat-model-chip is-missing"
                onClick={openModelSettings}
              >
                No AI key
              </button>
            )
          ) : null}
          {messages.length > 0 && !confirmClear ? (
            <button
              type="button"
              className="chat-clear"
              onClick={() => setConfirmClear(true)}
              disabled={streaming}
            >
              Clear chat
            </button>
          ) : null}
          {confirmClear ? (
            <span className="chat-confirm" role="alert">
              Clear chat?
              <button type="button" className="chat-confirm-yes" onClick={() => void clearChat()}>
                Clear
              </button>
              <button
                type="button"
                className="chat-confirm-no"
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </button>
            </span>
          ) : null}
        </div>
      </header>

      {keyMissing ? (
        <div className="chat-key" role="status">
          <span>No AI key is set for this project. Answers are paused.</span>
          <button type="button" onClick={openModelSettings}>
            Open AI settings
          </button>
        </div>
      ) : null}

      <div className="chat-body">
        <div
          className="chat-log"
          ref={scrollRef}
          onScroll={handleScroll}
          role="log"
          aria-label="Conversation"
        >
          {loadingHistory ? <p className="chat-muted">Loading conversation…</p> : null}

          {!loadingHistory && messages.length === 0 && !streaming ? (
            <div className="chat-empty">
              <p className="chat-empty-title">Ask about {projectName}</p>
              <p className="chat-empty-hint">
                {keyMissing
                  ? 'Add an AI key in Settings, then ask what the client needs, what changed, or what is blocked.'
                  : 'I answer from this project’s Slack history and the state this card has already derived. Nothing is posted to Slack.'}
              </p>
              <div className="chat-suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    type="button"
                    className="chat-suggestion"
                    key={suggestion}
                    onClick={() => applySuggestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message, index) => {
            const key = `${index}-${message.atIso}`
            return (
              <div
                className={`chat-msg is-${message.role}${message.stopped ? ' is-stopped' : ''}`}
                key={key}
              >
                <div className="chat-msg-meta">
                  <span>{message.role === 'user' ? 'You' : 'Orbit'}</span>
                  <span>{timeLabel(message.atIso)}</span>
                  {message.stopped ? <span>stopped</span> : null}
                </div>
                <div className="chat-bubble">
                  {message.role === 'assistant' ? (
                    <ChatMarkdown text={message.content} />
                  ) : (
                    message.content
                  )}
                </div>
                {message.role === 'assistant' ? (
                  <div className="chat-msg-actions">
                    <button
                      type="button"
                      className="chat-copy"
                      onClick={() => void copyMessage(key, message.content)}
                    >
                      {copiedKey === key ? 'Copied' : 'Copy'}
                    </button>
                    {message.sources && message.sources.length > 0 ? (
                      <div className="chat-sources" aria-label="Sources">
                        {message.sources.map((source) => (
                          <button
                            type="button"
                            className="chat-source"
                            key={`${source.source}:${source.channelId}:${source.ts}`}
                            title={`${sourceLabel(source.source)} · ${source.ts}`}
                            onClick={() => onOpenSource?.(source)}
                            disabled={!onOpenSource}
                          >
                            #{source.channelName}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}

          {streaming ? (
            <div className="chat-msg is-assistant" aria-live="off">
              <div className="chat-msg-meta">
                <span>Orbit</span>
              </div>
              <div className="chat-bubble">
                {streamText ? (
                  <ChatMarkdown text={streamText} />
                ) : (
                  <span className="chat-thinking" aria-label="Thinking">
                    <span className="chat-dot" />
                    <span className="chat-dot" />
                    <span className="chat-dot" />
                  </span>
                )}
              </div>
            </div>
          ) : null}

          {notice ? <p className="chat-notice">{notice}</p> : null}
        </div>

        {showJump ? (
          <button type="button" className="chat-jump" onClick={jumpToLatest}>
            Jump to latest
          </button>
        ) : null}
      </div>

      {failure ? (
        <div className="chat-error" role="alert">
          <span>{failure.message}</span>
          {failure.retryable && failure.mode !== 'none' && !streaming ? (
            <button type="button" onClick={() => void retry()}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <textarea
          ref={composerRef}
          value={draft}
          rows={1}
          aria-label="Ask about this project"
          placeholder={keyMissing ? 'Add an AI key to start chatting' : 'Ask about this project…'}
          disabled={streaming || keyMissing}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          onCompositionStart={() => {
            composingRef.current = true
          }}
          onCompositionEnd={() => {
            composingRef.current = false
          }}
        />
        {streaming ? (
          <button
            type="button"
            className="chat-send is-stop"
            onClick={() => void stop()}
            disabled={stopping}
          >
            {stopping ? 'Stopping…' : 'Stop'}
          </button>
        ) : (
          <button type="submit" className="chat-send" disabled={!canSend}>
            Send
          </button>
        )}
      </form>
      <p className="chat-hint">
        Enter sends, Shift+Enter adds a line. Answers use only this project’s stored Slack history
        and state — no messages are posted to Slack.
      </p>
      <p className="chat-visually-hidden" role="status" aria-live="polite">
        {liveMessage}
      </p>
    </section>
  )
}
