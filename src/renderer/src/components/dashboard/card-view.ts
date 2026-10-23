/** Card view-model (v2.4): the single place that decides what a dashboard card
 * shows, split into the three zones of the full-width card with sidebars.
 * The LLM insight wins over the local heuristics; the heuristics are the
 * fallback so a card never goes blank. Pure + DOM-free so it can be tested. */

import type {
  DashboardProjectSnapshot,
  InsightBlocker,
  InsightCommitment,
  InsightDecision,
  InsightHighlight,
  InsightMood,
  InsightStatus,
  InsightUrgency
} from '../../../../shared/dashboard-contract'

export interface CardDates {
  startDate?: string
  endDate?: string
  /** 'from chat' | 'manual' | 'not stated in chat' */
  badge: 'from chat' | 'manual' | 'not stated in chat'
}

export interface CardIdentity {
  index: number
  name: string
  clientName: string
  /** workspace name — ALWAYS shown (one card = one workspace) */
  teamName: string
  progress: number
  progressEvidence: string
  mood: InsightMood
  moodReason: string
  moodQuote: string
  dates: CardDates
  channels: Array<{ channelId: string; channelName: string; newCount: number; total: number }>
}

/* ===== v2.4 — LEFT SIDEBAR "PROJECT GUIDE" ===== */

export interface CardRequirement {
  text: string
  sourceFile?: string
  who?: string
  whenIso?: string
}

export interface CardDeliverable {
  name: string
  status: 'done' | 'in-progress' | 'pending' | 'not-started'
}

export interface CardFile {
  name: string
  type: 'pdf' | 'docx' | 'link' | 'image' | 'other'
  who?: string
  whenIso?: string
  url?: string
}

export interface CardPerson {
  name: string
  role?: string
  side: 'client' | 'us'
}

export interface CardMilestone {
  label: string
  dateIso: string
  done: boolean
}

export interface CardLeftSidebar {
  /** Section 1: Start & timeline */
  startTimeline: {
    startDate: CardDates['startDate']
    endDate: CardDates['endDate']
    dateBadge: CardDates['badge']
    milestones: CardMilestone[]
  }
  /** Section 2: Client requirements */
  requirements: CardRequirement[]
  /** Section 3: Scope & deliverables */
  scopeDeliverables: {
    inScope: string[]
    outOfScope: string[]
    deliverables: CardDeliverable[]
  }
  /** Section 4: Decisions */
  decisions: InsightDecision[]
  /** Section 5: Commitments */
  commitments: InsightCommitment[]
  /** Section 6: Files & links */
  files: CardFile[]
  /** Section 7: People & channels */
  peopleChannels: {
    people: CardPerson[]
    channels: Array<{ channelName: string; messageCount: number; hasNew: boolean }>
    quietChannelCount: number
  }
}

/* ===== v2.4 — CENTRE (visual overview + summary) ===== */

export interface CardCentreVisuals {
  /** Progress donut percentage */
  progressPercent: number
  /** Time elapsed bars data */
  timeElapsed: {
    hasDates: boolean
    startDate?: string
    endDate?: string
    daysUsed?: number
    daysLeft?: number
    totalDays?: number
    progressPercent?: number
    pace: 'behind' | 'on-pace' | 'ahead'
    paceLabel: string
  }
  /** Last 7 days activity bars */
  sevenDayBars: Array<{ date: string; count: number; isToday: boolean }>
}

export interface CardCentre {
  status: InsightStatus | null
  statusReason: string
  statusChange: string
  situationLine: string
  /** the single most important thing that just changed */
  recentLine: string
  highlights: InsightHighlight[]
  lastClientMessage: { who: string; whenIso: string; quote: string } | null
  needsReply: boolean
  urgency: InsightUrgency
  openQuestions: string[]
  nextStep: string
  visuals: CardCentreVisuals
}

/* ===== v2.4 — RIGHT SIDEBAR "ATTENTION & ACTIVITY" ===== */

export interface CardRightSidebar {
  /** Section 1: Needs reply & open questions */
  needsReplyOpenQuestions: {
    needsReply: boolean
    urgency: InsightUrgency
    openQuestions: string[]
    lastClientMessage: { who: string; whenIso: string; quote: string } | null
  }
  /** Section 2: Blockers */
  blockers: InsightBlocker[]
  /** Section 3: Risks */
  risks: string[]
  /** Section 4: Next steps */
  nextSteps: string[]
  /** Section 5: Client mood & signals */
  moodSignals: {
    mood: InsightMood
    moodReason: string
    moodQuote: string
  }
  /** Section 6: Activity */
  activity: {
    messages24h: number
    messages7d: number
    lastClientMessage: { who: string; whenIso: string; quote: string } | null
    myLastReply: { who: string; whenIso: string; quote: string } | null
  }
  /** Section 7: History */
  history: Array<{ from: string; to: string; dateIso: string; msgCount: number }>
}

export interface CardDetail {
  blockers: InsightBlocker[]
  commitments: InsightCommitment[]
  decisions: InsightDecision[]
  risks: string[]
  keywords: string[]
  hasMoreDetail: boolean
}

export interface CardView {
  identity: CardIdentity
  leftSidebar: CardLeftSidebar
  centre: CardCentre
  rightSidebar: CardRightSidebar
  detail: CardDetail
  /** AI badge text (model + age) or the heuristic label */
  aiBadge: string
  syncedLabel: string
}

export interface CardSummary {
  projectId: string
  index: number
  name: string
  workspaceName: string
  clientName: string
  status: InsightStatus | null
  needsReply: boolean
  inactive: boolean
  situationLine: string
  recentLine: string
  nextStep: string
  progress: number
  dates: CardDates
  daysUsed?: number
  daysTotal?: number
  pace: 'behind' | 'on-pace' | 'ahead'
  paceLabel: string
  week: Array<{ date: string; count: number; isToday: boolean }>
  lastClientAt: string | null
  myLastReplyAt: string | null
  counts: { questions: number; blockers: number; risks: number; files: number }
  score: number
  aiBadge: string
  syncedLabel: string
}



function fmtAge(iso: string | null): string {
  if (!iso) return 'never'
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** Compute time-elapsed bars data */
function computeTimeElapsed(
  startDate?: string,
  endDate?: string,
  progressPercent?: number
): CardCentreVisuals['timeElapsed'] {
  const now = Date.now()
  if (!startDate || !endDate) {
    return { hasDates: false, pace: 'on-pace', paceLabel: 'Dates not stated in chat' }
  }
  const startMs = new Date(`${startDate}T00:00:00Z`).getTime()
  const endMs = new Date(`${endDate}T23:59:59Z`).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { hasDates: false, pace: 'on-pace', paceLabel: 'Dates not stated in chat' }
  }
  const totalDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)))
  const daysUsed = Math.max(0, Math.ceil((now - startMs) / (1000 * 60 * 60 * 24)))
  const daysLeft = Math.max(0, Math.ceil((endMs - now) / (1000 * 60 * 60 * 24)))
  const timePercent = totalDays > 0 ? Math.min(100, Math.round((daysUsed / totalDays) * 100)) : 0
  const progress = progressPercent ?? 0
  const diff = progress - timePercent
  let pace: 'behind' | 'on-pace' | 'ahead' = 'on-pace'
  let paceLabel = 'On pace'
  if (diff <= -10) {
    pace = 'behind'
    paceLabel = 'Behind schedule'
  } else if (diff >= 5) {
    pace = 'ahead'
    paceLabel = 'Ahead of schedule'
  }
  return {
    hasDates: true,
    startDate,
    endDate,
    daysUsed,
    daysLeft,
    totalDays,
    progressPercent: progress,
    pace,
    paceLabel
  }
}

/** Compute last 7 days activity bars from per-channel data */
function computeSevenDayBars(
  perChannel: Array<{ latestMessageAt: string; messageCount: number }>
): Array<{ date: string; count: number; isToday: boolean }> {
  const now = new Date()
  const bars: Array<{ date: string; count: number; isToday: boolean }> = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const dayStart = d.getTime()
    const dayEnd = dayStart + 24 * 60 * 60 * 1000
    let count = 0
    for (const ch of perChannel) {
      if (!ch.latestMessageAt) continue
      const msgTime = new Date(ch.latestMessageAt).getTime()
      if (!Number.isFinite(msgTime)) continue
      if (msgTime >= dayStart && msgTime < dayEnd) {
        count += ch.messageCount ?? 0
      }
    }
    bars.push({
      date: d.toISOString().slice(0, 10),
      count,
      isToday: i === 0
    })
  }
  return bars
}

/** Compute messages in last 24h and 7d from per-channel data */
function computeActivityCounts(
  perChannel: Array<{ latestMessageAt: string; messageCount: number }>
): { messages24h: number; messages7d: number } {
  const now = Date.now()
  const day24 = 24 * 60 * 60 * 1000
  const day7 = 7 * day24
  let messages24h = 0
  let messages7d = 0
  for (const ch of perChannel) {
    if (!ch.latestMessageAt) continue
    const msgTime = new Date(ch.latestMessageAt).getTime()
    if (!Number.isFinite(msgTime)) continue
    const age = now - msgTime
    if (age <= day7) messages7d += ch.messageCount ?? 0
    if (age <= day24) messages24h += ch.messageCount ?? 0
  }
  return { messages24h, messages7d }
}

/** Normalize an insight so every v2.4 field exists (handles old saved insights). */
function normalizeInsight(insight: any): any {
  if (!insight) return null
  return {
    ...insight,
    statusChange: insight.statusChange ?? '',
    recentLine: insight.recentLine ?? '',
    requirements: Array.isArray(insight.requirements) ? insight.requirements : [],
    scope: insight.scope && typeof insight.scope === 'object'
      ? { in: Array.isArray(insight.scope.in) ? insight.scope.in : [], out: Array.isArray(insight.scope.out) ? insight.scope.out : [] }
      : { in: [], out: [] },
    deliverables: Array.isArray(insight.deliverables) ? insight.deliverables : [],
    files: Array.isArray(insight.files) ? insight.files : [],
    people: Array.isArray(insight.people) ? insight.people : [],
    milestones: Array.isArray(insight.milestones) ? insight.milestones : [],
    highlights: Array.isArray(insight.highlights) ? insight.highlights : [],
    blockers: Array.isArray(insight.blockers) ? insight.blockers : [],
    commitments: Array.isArray(insight.commitments) ? insight.commitments : [],
    decisions: Array.isArray(insight.decisions) ? insight.decisions : [],
    risks: Array.isArray(insight.risks) ? insight.risks : [],
    keywords: Array.isArray(insight.keywords) ? insight.keywords : [],
    dates: insight.dates && typeof insight.dates === 'object' ? insight.dates : {},
    clientAsk: insight.clientAsk && typeof insight.clientAsk === 'object'
      ? {
          needsReply: !!insight.clientAsk.needsReply,
          urgency: insight.clientAsk.urgency ?? 'normal',
          lastClientMessage: insight.clientAsk.lastClientMessage ?? null,
          openQuestions: Array.isArray(insight.clientAsk.openQuestions) ? insight.clientAsk.openQuestions : []
        }
      : { needsReply: false, urgency: 'normal', lastClientMessage: null, openQuestions: [] }
  }
}

export function buildCardView(snapshot: DashboardProjectSnapshot, index = 0): CardView {
  if (!snapshot || !snapshot.project) {
    // Return a minimal safe card view
    return {
      identity: { index, name: 'Unknown', clientName: '—', teamName: '—', progress: 0, progressEvidence: '', mood: 'neutral', moodReason: '', moodQuote: '', dates: { badge: 'not stated in chat' }, channels: [] },
      leftSidebar: { startTimeline: { startDate: undefined, endDate: undefined, dateBadge: 'not stated in chat', milestones: [] }, requirements: [], scopeDeliverables: { inScope: [], outOfScope: [], deliverables: [] }, decisions: [], commitments: [], files: [], peopleChannels: { people: [], channels: [], quietChannelCount: 0 } },
      centre: { status: null, statusReason: '', statusChange: '', situationLine: '', recentLine: '', highlights: [], lastClientMessage: null, needsReply: false, urgency: 'normal', openQuestions: [], nextStep: '', visuals: { progressPercent: 0, timeElapsed: { hasDates: false, pace: 'on-pace', paceLabel: 'Dates not stated in chat' }, sevenDayBars: [] } },
      rightSidebar: { needsReplyOpenQuestions: { needsReply: false, urgency: 'normal', openQuestions: [], lastClientMessage: null }, blockers: [], risks: [], nextSteps: [], moodSignals: { mood: 'neutral', moodReason: '', moodQuote: '' }, activity: { messages24h: 0, messages7d: 0, lastClientMessage: null, myLastReply: null }, history: [] },
      detail: { blockers: [], commitments: [], decisions: [], risks: [], keywords: [], hasMoreDetail: false },
      aiBadge: 'no insight yet',
      syncedLabel: 'never'
    }
  }
  const insight = normalizeInsight(snapshot.insight)
  const project = snapshot.project

  const dates: CardDates = insight
    ? insight.dates.startDate || insight.dates.endDate
      ? {
          startDate: insight.dates.startDate ?? snapshot.effectiveDates.startDate,
          endDate: insight.dates.endDate ?? snapshot.effectiveDates.endDate,
          badge: 'from chat'
        }
      : {
          startDate: snapshot.effectiveDates.startDate,
          endDate: snapshot.effectiveDates.endDate,
          badge: project.startDate || project.endDate ? 'manual' : 'not stated in chat'
        }
    : {
        startDate: snapshot.effectiveDates.startDate,
        endDate: snapshot.effectiveDates.endDate,
        badge: project.startDate || project.endDate ? 'manual' : 'not stated in chat'
      }

  const perChannel = Array.isArray(snapshot.perChannel) ? snapshot.perChannel : []
  const channels = perChannel.map((c) => ({
    channelId: c.channelId,
    channelName: c.channelName,
    newCount: c.newMessageCount ?? 0,
    total: c.messageCount
  }))

  const hasMoreDetail = Boolean(
    insight &&
    (insight.moodReason ||
      insight.moodQuote ||
      insight.commitments.length > 0 ||
      insight.decisions.length > 0 ||
      insight.risks.length > 0 ||
      insight.dates.evidence ||
      insight.keywords.length > 0)
  )

  // Progress for visuals
  const progressPercent = Number.isFinite(insight?.progress) ? insight.progress : (Number.isFinite(snapshot.completion) ? snapshot.completion : 0)

  // Time elapsed visual
  const timeElapsed = computeTimeElapsed(dates.startDate, dates.endDate, progressPercent)

  // 7-day bars
  const sevenDayBars = computeSevenDayBars(perChannel)

  // Activity counts
  const { messages24h, messages7d } = computeActivityCounts(perChannel)

  const aiBadge = snapshot.insightUpdatedAt
    ? `${snapshot.insightSource === 'heuristic' ? 'heuristic' : 'AI'} · ${fmtAge(snapshot.insightUpdatedAt)}${
        snapshot.insightModel ? ` · ${snapshot.insightModel}` : ''
      }`
    : 'no insight yet'

  // Build left sidebar
  const leftSidebar: CardLeftSidebar = {
    startTimeline: {
      startDate: dates.startDate,
      endDate: dates.endDate,
      dateBadge: dates.badge,
      milestones: insight?.milestones.map((m: any) => ({
        label: m.label,
        dateIso: m.dateIso,
        done: m.done
      })) ?? []
    },
    requirements: insight?.requirements.map((r: any) => ({
      text: r.text,
      sourceFile: r.sourceFile,
      who: r.who,
      whenIso: r.whenIso
    })) ?? [],
    scopeDeliverables: {
      inScope: insight?.scope.in ?? [],
      outOfScope: insight?.scope.out ?? [],
      deliverables: insight?.deliverables.map((d: any) => ({
        name: d.name,
        status: d.status
      })) ?? []
    },
    decisions: insight?.decisions ?? [],
    commitments: insight?.commitments ?? [],
    files: insight?.files.map((f: any) => ({
      name: f.name,
      type: f.type,
      who: f.who,
      whenIso: f.whenIso,
      url: f.url
    })) ?? [],
    peopleChannels: {
      people: insight?.people.map((p: any) => ({
        name: p.name,
        role: p.role,
        side: p.side
      })) ?? [],
      channels: channels
        .filter((c) => c.total > 0)
        .sort((a, b) => b.newCount - a.newCount)
        .map((c) => ({
          channelName: c.channelName,
          messageCount: c.total,
          hasNew: c.newCount > 0
        })),
      quietChannelCount: channels.filter((c) => c.total === 0).length
    }
  }

  // Build centre
  const centre: CardCentre = {
    status: insight ? insight.status : null,
    statusReason: insight ? insight.statusReason : '',
    statusChange: insight ? insight.statusChange : '',
    situationLine: insight
      ? insight.situationLine
      : (snapshot.summary.split('\n').find((l) => l.trim()) ?? ''),
    recentLine: insight ? insight.recentLine : '',
    highlights: insight ? insight.highlights : [],
    lastClientMessage: insight ? insight.clientAsk.lastClientMessage : null,
    needsReply: insight ? insight.clientAsk.needsReply : false,
    urgency: insight ? insight.clientAsk.urgency : 'normal',
    openQuestions: insight ? insight.clientAsk.openQuestions : [],
    nextStep: insight ? insight.nextStep : '',
    visuals: {
      progressPercent,
      timeElapsed,
      sevenDayBars
    }
  }

  // Build right sidebar
  const rightSidebar: CardRightSidebar = {
    needsReplyOpenQuestions: {
      needsReply: insight ? insight.clientAsk.needsReply : false,
      urgency: insight ? insight.clientAsk.urgency : 'normal',
      openQuestions: insight ? insight.clientAsk.openQuestions : [],
      lastClientMessage: insight ? insight.clientAsk.lastClientMessage : null
    },
    blockers: insight ? insight.blockers : [],
    risks: insight ? insight.risks : [],
    nextSteps: insight ? [insight.nextStep].filter(Boolean) : [],
    moodSignals: {
      mood: insight ? insight.mood : snapshot.mood.state,
      moodReason: insight ? insight.moodReason : snapshot.mood.signal,
      moodQuote: insight ? insight.moodQuote : ''
    },
    activity: {
      messages24h,
      messages7d,
      lastClientMessage: insight ? insight.clientAsk.lastClientMessage : null,
      myLastReply: null
    },
    history: []
  }

  return {
    identity: {
      index,
      name: project.name,
      clientName: project.clientName || project.teamName || '—',
      teamName: project.teamName ?? project.teamId,
      progress: progressPercent,
      progressEvidence: insight ? insight.progressEvidence : snapshot.mood.signal,
      mood: insight ? insight.mood : snapshot.mood.state,
      moodReason: insight ? insight.moodReason : snapshot.mood.signal,
      moodQuote: insight ? insight.moodQuote : '',
      dates,
      channels
    },
    leftSidebar,
    centre,
    rightSidebar,
    detail: {
      blockers: insight ? insight.blockers : [],
      commitments: insight ? insight.commitments : [],
      decisions: insight ? insight.decisions : [],
      risks: insight ? insight.risks : [],
      keywords: insight ? insight.keywords : [],
      hasMoreDetail
    },
    aiBadge,
    syncedLabel: `synced ${fmtAge(snapshot.lastUpdatedAt)}`
  }
}
export function buildCardSummary(snapshot: DashboardProjectSnapshot, index = 0): CardSummary {
  const insight = normalizeInsight(snapshot.insight)
  const project = snapshot.project
  const perChannel = Array.isArray(snapshot.perChannel) ? snapshot.perChannel : []

  const dates: CardDates = insight
    ? insight.dates.startDate || insight.dates.endDate
      ? { startDate: insight.dates.startDate ?? snapshot.effectiveDates.startDate, endDate: insight.dates.endDate ?? snapshot.effectiveDates.endDate, badge: 'from chat' }
      : { startDate: snapshot.effectiveDates.startDate, endDate: snapshot.effectiveDates.endDate, badge: project.startDate || project.endDate ? 'manual' : 'not stated in chat' }
    : { startDate: snapshot.effectiveDates.startDate, endDate: snapshot.effectiveDates.endDate, badge: project.startDate || project.endDate ? 'manual' : 'not stated in chat' }

  const progress = insight ? insight.progress : snapshot.completion
  const timeElapsed = computeTimeElapsed(dates.startDate, dates.endDate, progress)
  const sevenDayBars = computeSevenDayBars(perChannel)
  const { messages24h } = computeActivityCounts(perChannel)

  const needsReply = insight ? insight.clientAsk.needsReply : false
  const inactive = !insight?.clientAsk?.lastClientMessage && (Date.now() - new Date(snapshot.lastUpdatedAt ?? Date.now()).getTime()) > 24 * 60 * 60 * 1000

  const lastClientAt = insight?.clientAsk?.lastClientMessage?.whenIso ?? null
  const myLastReplyAt = null

  const counts = {
    questions: insight?.clientAsk?.openQuestions?.length ?? 0,
    blockers: insight?.blockers?.length ?? 0,
    risks: insight?.risks?.length ?? 0,
    files: insight?.files?.length ?? 0
  }

  // Importance score (higher = more urgent)
  let score = 0
  if (needsReply) score += 50
  if (insight?.status === 'blocked') score += 40
  if (insight?.status === 'at-risk') score += 30
  if (inactive) score += 20
  score += (snapshot.newMessageCount ?? 0) * 2
  score += (messages24h > 0 ? 10 : 0)

  const aiBadge = snapshot.insightUpdatedAt
    ? `${snapshot.insightSource === 'heuristic' ? 'heuristic' : 'AI'} · ${fmtAge(snapshot.insightUpdatedAt)}${snapshot.insightModel ? ` · ${snapshot.insightModel}` : ''}`
    : 'no insight yet'

  return {
    projectId: project.id,
    index,
    name: project.name,
    workspaceName: project.teamName ?? project.teamId,
    clientName: project.clientName || project.teamName || '—',
    status: insight ? insight.status : null,
    needsReply,
    inactive,
    situationLine: insight ? insight.situationLine : (snapshot.summary.split('\n').find((l) => l.trim()) ?? ''),
    recentLine: insight ? insight.recentLine : '',
    nextStep: insight ? insight.nextStep : '',
    progress,
    dates,
    daysUsed: timeElapsed.daysUsed,
    daysTotal: timeElapsed.totalDays,
    pace: timeElapsed.pace,
    paceLabel: timeElapsed.paceLabel,
    week: sevenDayBars,
    lastClientAt,
    myLastReplyAt,
    counts,
    score,
    aiBadge,
    syncedLabel: `synced ${fmtAge(snapshot.lastUpdatedAt)}`
  }
}
