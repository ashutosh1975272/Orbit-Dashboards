// @vitest-environment jsdom
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProfileSidebar } from '../../src/renderer/src/components/ProfileSidebar'

describe('ProfileSidebar Look Switcher Button Arrangement', () => {
  const defaultProps = {
    profiles: [],
    activeProfileId: null,
    activeAppId: null,
    selectedTeamId: null,
    syncingProfileId: null,
    email: '',
    onEmailChange: vi.fn(),
    googleBusy: false,
    statusLine: '',
    unreadCounts: {},
    recentWorkspaces: [],
    onAddGoogle: vi.fn(),
    onCancelGoogle: vi.fn(),
    onToggleSidebar: vi.fn(),
    onSelect: vi.fn(),
    onSelectApp: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onToggleMute: vi.fn(),
    onReorder: vi.fn(),
    onOpenInSplit: vi.fn(),
    onOpenWorkspace: vi.fn(),
    onSyncWorkspaces: vi.fn(),
    onPinFromAvailable: vi.fn(),
    onUnpin: vi.fn(),
    onDismissError: vi.fn(),
    onAddPlatform: vi.fn(),
    showLookSwitcher: true
  }

  it('renders look buttons in the order: Minimal, Cosmic, Ancient', () => {
    const onLookChange = vi.fn()
    const { container } = render(
      <ProfileSidebar
        {...defaultProps}
        sidebarLook="ancient"
        onLookChange={onLookChange}
      />
    )

    const switcher = container.querySelector('.sidebar-looks-switcher')
    expect(switcher).not.toBeNull()

    const buttons = switcher?.querySelectorAll('button')
    expect(buttons?.length).toBe(3)

    // Button 0: Minimal
    expect(buttons?.[0]?.textContent?.trim()).toBe('Minimal')
    expect(buttons?.[0]?.getAttribute('title')).toBe('Minimal')

    // Button 1: Cosmic
    expect(buttons?.[1]?.textContent?.trim()).toBe('Cosmic')
    expect(buttons?.[1]?.getAttribute('title')).toBe('Cosmic')

    // Button 2: Ancient
    expect(buttons?.[2]?.textContent?.trim()).toBe('Ancient')
    expect(buttons?.[2]?.getAttribute('title')).toBe('Ancient')
  })

  it('invokes onLookChange with the correct look identifier on button click', () => {
    const onLookChange = vi.fn()
    const { container } = render(
      <ProfileSidebar
        {...defaultProps}
        sidebarLook="ancient"
        onLookChange={onLookChange}
      />
    )

    const buttons = container.querySelectorAll('.sidebar-looks-switcher button')
    expect(buttons.length).toBe(3)

    // Click Minimal
    fireEvent.click(buttons[0])
    expect(onLookChange).toHaveBeenCalledWith('minimal')

    // Click Cosmic
    fireEvent.click(buttons[1])
    expect(onLookChange).toHaveBeenCalledWith('new-cosmic')

    // Click Ancient
    fireEvent.click(buttons[2])
    expect(onLookChange).toHaveBeenCalledWith('ancient')
  })
})
