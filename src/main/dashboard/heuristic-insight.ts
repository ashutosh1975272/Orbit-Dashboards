/**
 * v2.2 heuristic insight — the fallback that keeps the dashboard useful when
 * NVIDIA NIM is unavailable (no key, API error, timeout) or when the model
 * reply cannot be parsed. It reuses the local heuristics (mood, pace,
 * completion, distilled summary) so the card never goes blank because of AI.
 */

import type { DashboardProjectSnapshot, ProjectInsight } from '../../shared/dashboard-contract'

export function buildHeuristicInsight(snapshot: DashboardProjectSnapshot): ProjectInsight {
  const lines = snapshot.summary
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const status: ProjectInsight['status'] =
    snapshot.mood.state === 'tense'
      ? 'at-risk'
      : snapshot.pace === 'stale'
        ? 'waiting-on-client'
        : 'on-track'

  const nextStep =
    snapshot.pace === 'stale'
      ? 'Send a short status check to the client.'
      : snapshot.newMessageCount > 0
        ? 'Reply to the newest client message.'
        : ''

  return {
    status,
    mood: snapshot.mood.state,
    progress: snapshot.completion,
    progressEvidence: snapshot.mood.signal || (lines[0] ?? ''),
    situationLine: lines[0] ?? '',
    highlights: lines.slice(0, 3),
    blockers: [],
    nextStep,
    dates: {
      startDate: snapshot.effectiveDates.startDate,
      endDate: snapshot.effectiveDates.endDate
    },
    clientAsk: { needsReply: false, lastClientMessage: null }
  }
}
