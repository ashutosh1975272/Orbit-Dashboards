import React, { useEffect, useRef, useState } from 'react'
import type { XomniModeKey } from './workspace-nav'

interface AgentChatPanelProps {
  projectName: string
  projectId: string
  mode: XomniModeKey
}

interface ChatMsg { role: 'user' | 'assistant'; content: string }

export default function AgentChatPanel({ projectName, projectId, mode }: AgentChatPanelProps): React.ReactElement {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [current, setCurrent] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onChunk = (e: any) => {
      if (e?.projectId !== projectId) return
      setCurrent((c) => c + (e.chunk ?? ''))
    }
    const onDone = (e: any) => {
      if (e?.projectId !== projectId) return
      setMessages((m) => [...m, { role: 'assistant', content: current }])
      setCurrent('')
      setStreaming(false)
    }
    const onError = (e: any) => {
      if (e?.projectId !== projectId) return
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${e.error}` }])
      setCurrent('')
      setStreaming(false)
    }
    window.addEventListener('chat:chunk', onChunk as any)
    window.addEventListener('chat:done', onDone as any)
    window.addEventListener('chat:error', onError as any)
    return () => {
      window.removeEventListener('chat:chunk', onChunk as any)
      window.removeEventListener('chat:done', onDone as any)
      window.removeEventListener('chat:error', onError as any)
    }
  }, [projectId, current])

  const send = async () => {
    if (!input.trim() || streaming) return
    const text = input.trim()
    setMessages((m) => [...m, { role: 'user', content: text }])
    setInput('')
    setStreaming(true)
    setCurrent('')
    const api = (window as any).api?.dashboard
    await api?.projectChat?.({ projectId, message: text })
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, current])

  if (mode === 'agentwork') {
    return (
      <div className="ws-agent-empty">
        <p className="ws-agent-empty-title">AgentWork is not connected yet</p>
        <p className="ws-agent-empty-hint">Add the AgentWork MCP server in Settings.</p>
      </div>
    )
  }

  return (
    <div className="ws-agent" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ textAlign: m.role === 'user' ? 'right' : 'left', margin: '8px 0' }}>
            <span style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 8, background: m.role === 'user' ? '#3b82f6' : '#1f2937', color: '#fff' }}>
              {m.content}
            </span>
          </div>
        ))}
        {streaming && current && (
          <div style={{ textAlign: 'left', margin: '8px 0' }}>
            <span style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 8, background: '#1f2937', color: '#fff' }}>{current}</span>
          </div>
        )}
        {streaming && !current && <div style={{ color: '#9ca3af' }}>Thinking...</div>}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: 12, borderTop: '1px solid #374151' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
          placeholder={`Ask ${projectName} anything`}
          style={{ width: '100%', minHeight: 40 }}
          disabled={streaming}
        />
        <button onClick={send} disabled={streaming || !input.trim()}>{streaming ? 'Stop' : 'Send'}</button>
      </div>
    </div>
  )
}
