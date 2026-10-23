import { describe, expect, it } from 'vitest'
import type { DashboardProjectSnapshot } from '../../src/shared/dashboard-contract'
import { buildCardSummary, plural } from '../../src/renderer/src/components/dashboard/card-view'

const baseProject = (id: string, name: string, teamName: string): DashboardProjectSnapshot['project'] => ({
  id,
  name,
  clientName: 'Acme Corp',
  profileId: 'manual:K1',
  teamId: `T_${id}`,
  teamName,
  appId: 'slack',
  tokenSource: 'manual',
  monitors: [{ channelId: 'C1', channelName: 'general' }],
  createdAt: '2026-01-01T00:00:00Z'
})

const baseSnapshot = (overrides: Partial<DashboardProjectSnapshot> = {}): DashboardProjectSnapshot => ({
  project: baseProject('p1', 'Test Project', 'Workspace A'),
  summary: 'Weekly sync notes.',
  newMessageCount: 0,
  totalMessageCount: 0,
  completion: 50,
  pace: 'on-track',
  mood: { state: 'neutral', signal: '' },
  extractedDates: {},
  effectiveDates: { startDate: '2026-10-01', endDate: '2026-10-31' },
  perChannel: [],
  lastUpdatedAt: new Date().toISOString(),
  syncState: 'idle',
  ...overrides
})

const baseInsight = (overrides: Record<string, unknown> = {}): any => ({
  status: 'on-track',
  statusReason: '',
  statusChange: '',
  mood: 'neutral',
  moodReason: '',
  moodQuote: '',
  progress: 50,
  progressEvidence: '',
  situationLine: 'All systems normal.',
  recentLine: 'Client confirmed the mockups.',
  highlights: [],
  blockers: [],
  nextStep: 'Reply to the client email.',
  dates: {},
  clientAsk: {
    needsReply: false,
    urgency: 'normal',
    lastClientMessage: null,
    openQuestions: []
  },
  commitments: [],
  decisions: [],
  risks: [],
  keywords: [],
  requirements: [],
  scope: { in: [], out: [] },
  deliverables: [],
  files: [],
  people: [],
  milestones: [],
  ...overrides
})

describe('plural helper', () => {
  it('returns singular for 1', () => {
    expect(plural(1, 'file')).toBe('file')
    expect(plural(1, 'requirement')).toBe('requirement')
    expect(plural(1, 'question')).toBe('question')
  })

  it('returns plural for 0, 2, and beyond', () => {
    expect(plural(0, 'file')).toBe('files')
    expect(plural(2, 'file')).toBe('files')
    expect(plural(5, 'requirement')).toBe('requirements')
    expect(plural(10, 'question')).toBe('questions')
  })
})

describe('buildCardSummary — data contract', () => {
  it('maps recentLine to justChanged', () => {
    const snapshot = baseSnapshot({
      insight: baseInsight({ recentLine: 'Client asked for a redesign.' })
    })
    const view = buildCardSummary(snapshot, 0)
    expect(view.justChanged).toBe('Client asked for a redesign.')
  })

  it('includes urgency from clientAsk', () => {
    const snapshot = baseSnapshot({
      insight: baseInsight({ clientAsk: { needsReply: true, urgency: 'high' } })
    })
    const view = buildCardSummary(snapshot, 0)
    expect(view.urgency).toBe('high')
    expect(view.needsReply).toBe(true)
  })

  it('defaults urgency to normal when no insight', () => {
    const snapshot = baseSnapshot({ insight: null })
    const view = buildCardSummary(snapshot, 0)
    expect(view.urgency).toBe('normal')
  })

  it('includes requirements count in counts', () => {
    const snapshot = baseSnapshot({
      insight: baseInsight({
        requirements: [{ text: 'Must use Slack' }, { text: 'Must export PDF' }]
      })
    })
    const view = buildCardSummary(snapshot, 0)
    expect(view.counts.requirements).toBe(2)
    expect(view.counts.questions).toBe(0)
    expect(view.counts.blockers).toBe(0)
    expect(view.counts.risks).toBe(0)
    expect(view.counts.files).toBe(0)
  })

  it('counts blockers, risks, files correctly', () => {
    const snapshot = baseSnapshot({
      insight: baseInsight({
        blockers: [{ what: 'No access' }],
        risks: ['Budget cut'],
        files: [{ name: 'spec.pdf', type: 'pdf' }]
      })
    })
    const view = buildCardSummary(snapshot, 0)
    expect(view.counts.blockers).toBe(1)
    expect(view.counts.risks).toBe(1)
    expect(view.counts.files).toBe(1)
  })
})

describe('buildCardSummary — score formula', () => {
  it('scores needsReply +35', () => {
    const a = baseSnapshot({ insight: baseInsight({ clientAsk: { needsReply: true, urgency: 'normal' } }) })
    const b = baseSnapshot({ insight: baseInsight({ clientAsk: { needsReply: false, urgency: 'normal' } }) })
    expect(buildCardSummary(a, 0).score).toBeGreaterThan(buildCardSummary(b, 0).score)
  })

  it('scores high urgency +15', () => {
    const a = baseSnapshot({ insight: baseInsight({ clientAsk: { needsReply: false, urgency: 'high' } }) })
    const b = baseSnapshot({ insight: baseInsight({ clientAsk: { needsReply: false, urgency: 'normal' } }) })
    expect(buildCardSummary(a, 0).score).toBeGreaterThan(buildCardSummary(b, 0).score)
  })

  it('weights blocked highest among statuses', () => {
    const blocked = baseSnapshot({ insight: baseInsight({ status: 'blocked' }) })
    const atRisk = baseSnapshot({ insight: baseInsight({ status: 'at-risk' }) })
    const waiting = baseSnapshot({ insight: baseInsight({ status: 'waiting-on-client' }) })
    const onTrack = baseSnapshot({ insight: baseInsight({ status: 'on-track' }) })
    expect(buildCardSummary(blocked, 0).score).toBeGreaterThan(buildCardSummary(atRisk, 0).score)
    expect(buildCardSummary(atRisk, 0).score).toBeGreaterThan(buildCardSummary(waiting, 0).score)
    expect(buildCardSummary(waiting, 0).score).toBeGreaterThan(buildCardSummary(onTrack, 0).score)
  })

  it('penalises 48h+ silence', () => {
    const stale = baseSnapshot({
      lastUpdatedAt: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString(),
      insight: baseInsight({ clientAsk: { needsReply: false, lastClientMessage: null } })
    })
    const fresh = baseSnapshot({
      lastUpdatedAt: new Date().toISOString(),
      insight: baseInsight({ clientAsk: { needsReply: false, lastClientMessage: { who: 'c', whenIso: new Date().toISOString(), quote: 'hi' } } })
    })
    expect(buildCardSummary(stale, 0).score).toBeLessThan(buildCardSummary(fresh, 0).score)
  })

  it('scores new messages up to +15', () => {
    const a = baseSnapshot({ newMessageCount: 50, insight: null })
    const b = baseSnapshot({ newMessageCount: 0, insight: null })
    expect(buildCardSummary(a, 0).score).toBeGreaterThan(buildCardSummary(b, 0).score)
  })
})

describe('buildCardSummary — inactive detection', () => {
  it('detects inactive when no client message and 24h+ since update', () => {
    const snapshot = baseSnapshot({
      lastUpdatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      insight: baseInsight({ clientAsk: { needsReply: false, lastClientMessage: null } })
    })
    expect(buildCardSummary(snapshot, 0).inactive).toBe(true)
  })

  it('is not inactive when client messaged recently', () => {
    const snapshot = baseSnapshot({
      lastUpdatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      insight: baseInsight({
        clientAsk: {
          needsReply: false,
          lastClientMessage: { who: 'client', whenIso: new Date().toISOString(), quote: 'hello' }
        }
      })
    })
    expect(buildCardSummary(snapshot, 0).inactive).toBe(false)
  })
})

describe('buildCardSummary — two-workspace isolation', () => {
  it('keeps workspace data separate per project', () => {
    const a = baseSnapshot({
      project: baseProject('p1', 'Alpha Project', 'Workspace A'),
      insight: baseInsight({ situationLine: 'Alpha situation', status: 'blocked' })
    })
    const b = baseSnapshot({
      project: baseProject('p2', 'Beta Project', 'Workspace B'),
      insight: baseInsight({ situationLine: 'Beta situation', status: 'on-track' })
    })
    const va = buildCardSummary(a, 0)
    const vb = buildCardSummary(b, 0)
    expect(va.projectId).toBe('p1')
    expect(va.workspaceName).toBe('Workspace A')
    expect(va.name).toBe('Alpha Project')
    expect(va.status).toBe('blocked')
    expect(vb.projectId).toBe('p2')
    expect(vb.workspaceName).toBe('Workspace B')
    expect(vb.name).toBe('Beta Project')
    expect(vb.status).toBe('on-track')
  })
})
