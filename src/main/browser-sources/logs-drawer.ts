export interface LogDrawerData {
  projectId: string
  timeline: Array<{ runId: string; trigger: string; duration?: number; count?: number; llmCalls?: number }>
  approvals: Array<{ id: string; channel: string; status: string }>
}

export function buildLogDrawerData(projectId: string, runs: LogDrawerData['timeline'], approvals: LogDrawerData['approvals']): LogDrawerData {
  return { projectId, timeline: runs, approvals }
}
