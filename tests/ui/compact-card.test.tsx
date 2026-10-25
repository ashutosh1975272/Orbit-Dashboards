// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import CompactCard from '../../src/renderer/src/components/dashboard/CompactCard'
import type { CardSummary } from '../../src/renderer/src/components/dashboard/card-view'

afterEach(cleanup)

function summary(overrides: Partial<CardSummary> = {}): CardSummary {
  return {
    projectId: 'p1',
    index: 0,
    name: 'Acme rollout',
    workspaceName: 'Acme Team',
    clientName: 'Acme',
    status: 'on-track',
    needsReply: false,
    inactive: false,
    urgency: 'normal',
    situationLine: 'Waiting on the client',
    justChanged: '',
    nextStep: '',
    progress: null,
    dates: { badge: 'not stated in chat' },
    pace: 'on-pace',
    paceLabel: 'On pace',
    week: [],
    lastClientAt: new Date().toISOString(),
    myLastReplyAt: null,
    counts: { questions: 0, blockers: 0, risks: 0, files: 0, requirements: 0 },
    score: 0,
    aiBadge: 'no insight yet',
    syncedLabel: 'synced now',
    ...overrides
  }
}

const noop = (): void => undefined

function renderCard(overrides: Partial<CardSummary>): void {
  render(
    <CompactCard
      summary={summary(overrides)}
      onToggle={noop}
      onSync={noop}
      onSettings={noop}
      onRemove={noop}
      syncing={false}
    />
  )
}

describe('CompactCard progress', () => {
  it('shows a dash and an honest reason when progress is unknown', () => {
    renderCard({ progress: null })
    const meter = screen.getByTitle(/Progress not stated in chat/)
    expect(meter.textContent).toContain('—')
    expect(meter.textContent).not.toContain('%')
  })

  it('shows the real percentage when progress exists', () => {
    renderCard({ progress: 50 })
    const meter = screen.getByTitle(/50% complete/)
    expect(meter.textContent).toContain('50%')
  })
})
