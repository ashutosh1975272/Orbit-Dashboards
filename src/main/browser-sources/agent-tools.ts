export interface ApprovalQueueItem {
  id: string
  channel: string
  text: string
  createdAt: string
  status: 'pending' | 'approved' | 'rejected'
}

export class ApprovalQueue {
  private items: ApprovalQueueItem[] = []
  private newId: () => string
  constructor(newId?: () => string) {
    this.newId = newId ?? (() => `draft-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
  }
  enqueue(channel: string, text: string): ApprovalQueueItem {
    const item: ApprovalQueueItem = { id: this.newId(), channel, text, createdAt: new Date().toISOString(), status: 'pending' }
    this.items.push(item)
    return item
  }
  list(): ApprovalQueueItem[] { return [...this.items] }
  approve(id: string): boolean {
    const it = this.items.find(i => i.id === id)
    if (!it) return false
    it.status = 'approved'
    return true
  }
  reject(id: string): boolean {
    const it = this.items.find(i => i.id === id)
    if (!it) return false
    it.status = 'rejected'
    return true
  }
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(the\s+)?above/i,
  /system\s*:/i,
  /you\s+are\s+now/i
]

export function isPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some(p => p.test(text ?? ''))
}

export interface AgentToolContext {
  readMessages: (channel: string, limit?: number) => Promise<unknown[]>
  searchMessages: (query: string) => Promise<unknown[]>
  listUnread: () => Promise<unknown[]>
}

export class BrowserAgentTools {
  private queue: ApprovalQueue
  constructor(queue?: ApprovalQueue) {
    this.queue = queue ?? new ApprovalQueue()
  }
  getApprovalQueue(): ApprovalQueue { return this.queue }

  async getUnread(ctx: AgentToolContext): Promise<unknown[]> {
    return ctx.listUnread()
  }
  async readChannel(ctx: AgentToolContext, channel: string, limit = 50): Promise<unknown[]> {
    return ctx.readMessages(channel, limit)
  }
  async searchMessages(ctx: AgentToolContext, query: string): Promise<unknown[]> {
    if (isPromptInjection(query)) return []
    return ctx.searchMessages(query)
  }
  draftMessage(channel: string, text: string): ApprovalQueueItem | null {
    if (isPromptInjection(text)) return null
    return this.queue.enqueue(channel, text)
  }
}
