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

  it('renders look buttons in the order: Minimal, Cosmic, Ancient, Basic', () => {
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
    expect(buttons?.length).toBe(4)

    // Button 0: Minimal
    expect(buttons?.[0]?.textContent?.trim()).toBe('Minimal')
    expect(buttons?.[0]?.getAttribute('title')).toBe('Minimal')

    // Button 1: Cosmic
    expect(buttons?.[1]?.textContent?.trim()).toBe('Cosmic')
    expect(buttons?.[1]?.getAttribute('title')).toBe('Cosmic')

    // Button 2: Ancient
    expect(buttons?.[2]?.textContent?.trim()).toBe('Ancient')
    expect(buttons?.[2]?.getAttribute('title')).toBe('Ancient')

    // Button 3: Basic
    expect(buttons?.[3]?.textContent?.trim()).toBe('Basic')
    expect(buttons?.[3]?.getAttribute('title')).toBe('Basic')
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
    expect(buttons.length).toBe(4)

    // Click Minimal
    fireEvent.click(buttons[0])
    expect(onLookChange).toHaveBeenCalledWith('minimal')

    // Click Cosmic
    fireEvent.click(buttons[1])
    expect(onLookChange).toHaveBeenCalledWith('new-cosmic')

    // Click Ancient
    fireEvent.click(buttons[2])
    expect(onLookChange).toHaveBeenCalledWith('ancient')

    // Click Basic
    fireEvent.click(buttons[3])
    expect(onLookChange).toHaveBeenCalledWith('basic')
  })

  it('renders Google email input when showGoogleEmailInputInSidebar is true in Minimal look', () => {
    const { container } = render(
      <ProfileSidebar
        {...defaultProps}
        sidebarLook="minimal"
        showGoogleEmailInputInSidebar={true}
      />
    )

    const emailInput = container.querySelector('#google-email')
    expect(emailInput).not.toBeNull()

    const submitBtn = container.querySelector('button[aria-label="Continue with Google"]')
    expect(submitBtn).not.toBeNull()
  })

  it('hides Google email input when showGoogleEmailInputInSidebar is false in Minimal look', () => {
    const { container } = render(
      <ProfileSidebar
        {...defaultProps}
        sidebarLook="minimal"
        showGoogleEmailInputInSidebar={false}
      />
    )

    const emailInput = container.querySelector('#google-email')
    expect(emailInput).toBeNull()
  })

  it('hides cosmic-nav-selectors dropdown and quick nav buttons in Minimal look', () => {
    const { container } = render(
      <ProfileSidebar
        {...defaultProps}
        sidebarLook="minimal"
        showSidebarProfileNavButton={true}
        showSidebarDashboardNavButton={true}
      />
    )

    // The All Projects / level-1 dropdown container is hidden
    const dropdown = container.querySelector('.cosmic-nav-selectors')
    expect(dropdown).toBeNull()

    // Quick nav buttons (All Profiles / Full Dashboard) are hidden
    const quickNav = container.querySelector('.cosmic-quick-nav-buttons')
    expect(quickNav).toBeNull()
  })
})
