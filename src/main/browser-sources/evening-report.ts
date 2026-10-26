export interface EveningReportSection {
  title: string
  items: string[]
}

export interface EveningReport {
  generatedAt: string
  projectId: string
  sections: EveningReportSection[]
}

export function buildEveningReport(projectId: string, data: {
  clientMessages?: string[]
  completed?: string[]
  nextSteps?: string[]
}): EveningReport {
  return {
    generatedAt: new Date().toISOString(),
    projectId,
    sections: [
      { title: 'Client ne kya bola', items: data.clientMessages ?? [] },
      { title: 'Kya complete hua', items: data.completed ?? [] },
      { title: 'Kal kya karna hai', items: data.nextSteps ?? [] }
    ]
  }
}

export class EveningReportScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null
  private hour: number
  private minute: number
  constructor(hour = 18, minute = 0) {
    this.hour = hour
    this.minute = minute
  }
  schedule(onFire: () => void): void {
    const now = new Date()
    const next = new Date(now)
    next.setHours(this.hour, this.minute, 0, 0)
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
    const delay = next.getTime() - now.getTime()
    this.timer = setTimeout(() => {
      onFire()
      this.schedule(onFire)
    }, delay)
  }
  cancel(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
  }
}
