import { describe, expect, it } from 'vitest'
import { appLabel, sidebarAppLabel } from '../../src/shared/types'

describe('sidebar app labels', () => {
  it('shows Project in place of the Slack app name in the main sidebar', () => {
    expect(sidebarAppLabel('slack')).toBe('Project')
  })

  it('keeps the other app names unchanged', () => {
    expect(sidebarAppLabel('teams')).toBe('Teams')
    expect(sidebarAppLabel('whatsapp')).toBe('WhatsApp')
  })

  it('keeps the real app name for the app picker and command palette', () => {
    expect(appLabel('slack')).toBe('Slack')
  })
})
