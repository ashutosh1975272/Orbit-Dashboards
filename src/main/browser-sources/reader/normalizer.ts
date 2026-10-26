import { createHash } from 'node:crypto'
import type { DashboardStoredMessage } from '../..//dashboard/delta-store'
import type { BrowserPlatformType } from '../browser-source-types'

export interface RawScrapedMessage {
  rawTs?: string | number
  sender?: string
  text?: string
  threadTs?: string
  permalink?: string
  replyCount?: number
}

export function createMessageHash(
  sender: string,
  text: string,
  ts: string,
  channelId: string
): string {
  const payload = `${channelId}|${sender.trim()}|${ts.trim()}|${text.trim()}`
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

export function cleanMessageText(rawText: string | undefined): string {
  if (!rawText) return ''
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\u200B/g, ' ') // zero-width space -> space
    .replace(/[\u200C\u200D\uFEFF]/g, '') // zero-width joiner/non-joiner/bom
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function normalizeTimestamp(rawTs?: string | number, fallbackIso?: string): string {
  if (typeof rawTs === 'string') {
    const trimmed = rawTs.trim()
    // Slack-style timestamp: digits optionally followed by dot and digits
    if (/^\d{10}(?:\.\d+)?$/.test(trimmed)) {
      return trimmed.includes('.') ? trimmed : `${trimmed}.000000`
    }
    // Check if it's a valid date string
    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed)) {
      return (parsed / 1000).toFixed(6)
    }
  }

  if (typeof rawTs === 'number' && Number.isFinite(rawTs)) {
    // If it's in milliseconds (> 10^11), convert to seconds
    const seconds = rawTs > 1e11 ? rawTs / 1000 : rawTs
    return seconds.toFixed(6)
  }

  if (fallbackIso) {
    const parsed = Date.parse(fallbackIso)
    if (!Number.isNaN(parsed)) {
      return (parsed / 1000).toFixed(6)
    }
  }

  return (Date.now() / 1000).toFixed(6)
}

export function normalizeScrapedMessage(
  raw: RawScrapedMessage,
  _channelId: string,
  platformType: BrowserPlatformType
): DashboardStoredMessage {
  const text = cleanMessageText(raw.text)
  const ts = normalizeTimestamp(raw.rawTs)
  const user = (raw.sender ?? 'Anonymous').trim()

  const msg: DashboardStoredMessage = {
    ts,
    user,
    text,
    source: `browser:${platformType}`
  }

  if (raw.threadTs) {
    msg.threadTs = normalizeTimestamp(raw.threadTs)
  }

  if (raw.permalink) {
    msg.permalink = raw.permalink
  }

  if (typeof raw.replyCount === 'number' && raw.replyCount > 0) {
    msg.replyCount = raw.replyCount
  }

  return msg
}

export function deduplicateMessages(
  messages: DashboardStoredMessage[],
  channelId: string
): DashboardStoredMessage[] {
  const seen = new Set<string>()
  const deduped: DashboardStoredMessage[] = []

  for (const msg of messages) {
    const hash = createMessageHash(msg.user ?? '', msg.text ?? '', msg.ts, channelId)
    if (!seen.has(hash)) {
      seen.add(hash)
      deduped.push(msg)
    }
  }

  // Sort chronologically ascending
  return deduped.sort((a, b) => Number(a.ts) - Number(b.ts))
}

