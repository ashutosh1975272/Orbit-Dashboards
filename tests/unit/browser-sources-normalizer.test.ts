import { describe, it, expect } from 'vitest'
import {
  normalizeTimestamp,
  cleanMessageText,
  deduplicateMessages,
  normalizeScrapedMessage
} from '../../src/main/browser-sources/reader/normalizer'

describe('normalizeTimestamp', () => {
  it('handles Slack ts strings (10-digit epoch)', () => {
    const result = normalizeTimestamp('1700000000')
    expect(result).toBe('1700000000.000000')
  })

  it('handles Slack ts strings with dot already', () => {
    const result = normalizeTimestamp('1700000000.123456')
    expect(result).toBe('1700000000.123456')
  })

  it('handles epoch number in seconds', () => {
    const result = normalizeTimestamp(1700000000)
    expect(result).toBe('1700000000.000000')
  })

  it('handles epoch number in milliseconds (> 1e11)', () => {
    const result = normalizeTimestamp(1700000000000)
    expect(result).toBe('1700000000.000000')
  })

  it('handles ISO date string', () => {
    const result = normalizeTimestamp('2023-11-14T22:13:20.000Z')
    expect(Number(result)).toBeCloseTo(1700000000, -2)
  })

  it('returns a numeric ts string for empty input', () => {
    const result = normalizeTimestamp('')
    const num = Number(result)
    expect(Number.isFinite(num)).toBe(true)
    expect(num).toBeGreaterThan(0)
  })

  it('returns a numeric ts string for undefined input', () => {
    const result = normalizeTimestamp(undefined)
    const num = Number(result)
    expect(Number.isFinite(num)).toBe(true)
  })

  it('uses fallback ISO when rawTs is invalid', () => {
    const fallback = '2023-01-01T00:00:00.000Z'
    const result = normalizeTimestamp('not-a-ts', fallback)
    expect(Number(result)).toBeCloseTo(Date.parse(fallback) / 1000, -1)
  })
})

describe('cleanMessageText', () => {
  it('strips zero-width characters', () => {
    const input = 'hello\u200Bworld\u200D!'
    expect(cleanMessageText(input)).toBe('hello world!')
  })

  it('collapses multiple spaces and tabs', () => {
    expect(cleanMessageText('foo   bar\t\tbaz')).toBe('foo bar baz')
  })

  it('normalizes CRLF to LF', () => {
    expect(cleanMessageText('line1\r\nline2')).toBe('line1\nline2')
  })

  it('strips BOM character', () => {
    expect(cleanMessageText('\uFEFFhello')).toBe('hello')
  })

  it('trims leading and trailing whitespace', () => {
    expect(cleanMessageText('  hello  ')).toBe('hello')
  })

  it('returns empty string for undefined', () => {
    expect(cleanMessageText(undefined)).toBe('')
  })
})

describe('deduplicateMessages', () => {
  it('removes exact duplicate messages', () => {
    const msgs = [
      { ts: '1700000001.000000', user: 'alice', text: 'hello', source: 'browser:slack' as const },
      { ts: '1700000001.000000', user: 'alice', text: 'hello', source: 'browser:slack' as const }
    ]
    const result = deduplicateMessages(msgs, 'C12345')
    expect(result).toHaveLength(1)
  })

  it('keeps messages that differ in text', () => {
    const msgs = [
      { ts: '1700000001.000000', user: 'alice', text: 'hello', source: 'browser:slack' as const },
      { ts: '1700000002.000000', user: 'alice', text: 'world', source: 'browser:slack' as const }
    ]
    const result = deduplicateMessages(msgs, 'C12345')
    expect(result).toHaveLength(2)
  })

  it('keeps messages that differ in sender', () => {
    const msgs = [
      { ts: '1700000001.000000', user: 'alice', text: 'hello', source: 'browser:slack' as const },
      { ts: '1700000001.000000', user: 'bob', text: 'hello', source: 'browser:slack' as const }
    ]
    const result = deduplicateMessages(msgs, 'C12345')
    expect(result).toHaveLength(2)
  })

  it('sorts messages chronologically ascending', () => {
    const msgs = [
      { ts: '1700000003.000000', user: 'alice', text: 'c', source: 'browser:slack' as const },
      { ts: '1700000001.000000', user: 'alice', text: 'a', source: 'browser:slack' as const },
      { ts: '1700000002.000000', user: 'alice', text: 'b', source: 'browser:slack' as const }
    ]
    const result = deduplicateMessages(msgs, 'C12345')
    expect(result[0].text).toBe('a')
    expect(result[1].text).toBe('b')
    expect(result[2].text).toBe('c')
  })
})

describe('normalizeScrapedMessage', () => {
  it('produces a DashboardStoredMessage with source browser:slack', () => {
    const raw = { rawTs: '1700000001', sender: 'Alice', text: 'Hello world' }
    const result = normalizeScrapedMessage(raw, 'C12345', 'slack')
    expect(result.source).toBe('browser:slack')
    expect(result.user).toBe('Alice')
    expect(result.text).toBe('Hello world')
    expect(result.ts).toBe('1700000001.000000')
  })

  it('uses Anonymous when sender is missing', () => {
    const raw = { rawTs: '1700000001', text: 'Hello' }
    const result = normalizeScrapedMessage(raw, 'C12345', 'slack')
    expect(result.user).toBe('Anonymous')
  })

  it('cleans zero-width chars from message text', () => {
    const raw = { rawTs: '1700000001', sender: 'A', text: 'hello\u200Bworld' }
    const result = normalizeScrapedMessage(raw, 'C12345', 'slack')
    expect(result.text).toBe('hello world')
  })

  it('includes threadTs when provided', () => {
    const raw = { rawTs: '1700000002', sender: 'A', text: 'reply', threadTs: '1700000001' }
    const result = normalizeScrapedMessage(raw, 'C12345', 'slack')
    expect(result.threadTs).toBe('1700000001.000000')
  })

  it('sets source to browser:teams for teams platform', () => {
    const raw = { rawTs: '1700000001', sender: 'Bob', text: 'hey' }
    const result = normalizeScrapedMessage(raw, 'C12345', 'teams')
    expect(result.source).toBe('browser:teams')
  })
})
