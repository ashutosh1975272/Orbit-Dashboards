import React, { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '../../../../shared/ipc-contract'
import type { DashboardGlobalConfig } from '../../../../shared/dashboard-contract'
import { CustomLink, Profile } from '../../../../shared/types'
import { useProfileStore } from '../../hooks/useProfiles'
import { modKey } from '../../lib/shortcut-label'
import AiSettingsForm from './AiSettingsForm'
import TeamSlackSettings from './TeamSlackSettings'

export type SettingsTabKey = 'general' | 'sidebar' | 'ai' | 'our_slack' | 'accounts' | 'maintenance'

interface UnifiedSettingsModalProps {
  open: boolean
  initialTab?: SettingsTabKey
  settings: AppSettings
  onClose: () => void
  onChangeSettings: (patch: Partial<AppSettings>) => void
  onClearAllProfiles: () => void
  onExportProfiles: () => void
  onImportProfiles: () => void
  onAdminLogout: () => void
  onAddGoogleAccount?: () => void
  onSelectProfile?: (profileId: string) => void
  onOpenCustomLink?: (profileId: string, link: CustomLink) => void
}

export function UnifiedSettingsModal({
  open,
  initialTab = 'general',
  settings,
  onClose,
  onChangeSettings,
  onClearAllProfiles,
  onExportProfiles,
  onImportProfiles,
  onAdminLogout,
  onAddGoogleAccount,
  onSelectProfile: _onSelectProfile,
  onOpenCustomLink: _onOpenCustomLink
}: UnifiedSettingsModalProps): React.JSX.Element | null {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(initialTab)
  const [globalConfig, setGlobalConfig] = useState<DashboardGlobalConfig | null>(null)

  // Accounts state
  const profiles = useProfileStore((s) => s.profiles)
  const [addingLinkForProfileId, setAddingLinkForProfileId] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [customUrl, setCustomUrl] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab)
    }
  }, [open, initialTab])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = (): void => {
      void window.api.dashboard
        .getGlobalConfig()
        .then((next) => {
          if (!cancelled) setGlobalConfig(next)
        })
        .catch(() => undefined)
    }
    load()
    const off = window.api.dashboard.onConfigChanged((next) => {
      if (!cancelled) setGlobalConfig(next)
    })
    return () => {
      cancelled = true
      off()
    }
  }, [open])

  const handleToggleSidebarVisibility = useCallback(async (profile: Profile) => {
    try {
      const nextHidden = !profile.hiddenInSidebar
      const updated = await window.api.profiles.setHiddenInSidebar(profile.id, nextHidden)
      useProfileStore.setState((prev) => ({
        profiles: prev.profiles.map((p) => (p.id === updated.id ? updated : p))
      }))
    } catch (err) {
      console.error('Failed to toggle profile sidebar visibility', err)
    }
  }, [])

  const handleToggleLinkVisibility = useCallback(async (profileId: string, link: CustomLink) => {
    try {
      const nextHidden = !link.hiddenInSidebar
      const updated = await window.api.profiles.setLinkHiddenInSidebar(profileId, link.id, nextHidden)
      useProfileStore.setState((prev) => ({
        profiles: prev.profiles.map((p) => (p.id === updated.id ? updated : p))
      }))
    } catch (err) {
      console.error('Failed to toggle link sidebar visibility', err)
    }
  }, [])

  const handleRemoveCustomLink = useCallback(async (profileId: string, linkId: string) => {
    try {
      const updated = await window.api.profiles.removeCustomLink(profileId, linkId)
      useProfileStore.setState((prev) => ({
        profiles: prev.profiles.map((p) => (p.id === updated.id ? updated : p))
      }))
    } catch (err) {
      console.error('Failed to remove custom link', err)
    }
  }, [])

  const handleAddCustomLink = async (profileId: string): Promise<void> => {
    if (!customUrl.trim()) return
    setErrorMsg(null)
    try {
      const finalName = customName.trim() || customUrl.trim()
      const updated = await window.api.profiles.addCustomLink(profileId, {
        name: finalName,
        url: customUrl.trim()
      })
      useProfileStore.setState((prev) => ({
        profiles: prev.profiles.map((p) => (p.id === updated.id ? updated : p))
      }))
      setAddingLinkForProfileId(null)
      setCustomName('')
      setCustomUrl('')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add custom app')
    }
  }

  if (!open) return null

  const nvidiaStatus = globalConfig
    ? globalConfig.nvidia.status === 'ok'
      ? 'Connected'
      : globalConfig.nvidia.configured
        ? 'Saved, not verified'
        : 'Not configured'
    : 'Checking…'

  const navItems = [
    { key: 'general' as const, label: 'Preferences & Appearance', icon: '🎨' },
    { key: 'sidebar' as const, label: 'Sidebar & Navigation', icon: '📑' },
    { key: 'ai' as const, label: 'Global AI & NVIDIA NIM', icon: '🤖' },
    { key: 'our_slack' as const, label: 'Team Slack (Our Slack)', icon: '🏢' },
    { key: 'accounts' as const, label: 'Accounts & Workspaces', icon: '👥' },
    { key: 'maintenance' as const, label: 'System & Maintenance', icon: '🛡️' }
  ]

  return (
    <div
      className="platform-settings-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ zIndex: 1250 }}
    >
      <div
        className="platform-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Global Settings Hub"
        style={{
          width: '94vw',
          maxWidth: '1240px',
          height: '86vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#090d16',
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden'
        }}
      >
        {/* Header Bar */}
        <header
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.6)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>⚙️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#f8fafc' }}>
                Cosmic Global Settings Hub
              </h2>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                Single source of truth for global preferences, AI keys, team integrations, and accounts.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn ghost"
            onClick={onClose}
            style={{ color: '#94a3b8', fontSize: '13px' }}
          >
            ✕ Close
          </button>
        </header>

        {/* 2-Column Layout */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Navigation Rail */}
          <aside
            style={{
              width: '260px',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(10, 15, 29, 0.95)',
              padding: '16px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            {navItems.map((item) => {
              const active = activeTab === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: active ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    color: active ? '#60a5fa' : '#94a3b8',
                    border: active ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: active ? 600 : 500,
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </aside>

          {/* Right Content Pane */}
          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px 32px',
              background: '#090d16'
            }}
          >
            {/* TAB: GENERAL / PREFERENCES */}
            {activeTab === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <header>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>
                    Preferences & Appearance
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Control application theme, layout density, and notification behaviors.
                  </p>
                </header>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    background: 'rgba(15, 23, 42, 0.4)',
                    padding: '20px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <label className="settings-row">
                    <span>Theme</span>
                    <select
                      value={settings.theme}
                      onChange={(e) => onChangeSettings({ theme: e.target.value as AppSettings['theme'] })}
                    >
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="system">System</option>
                    </select>
                  </label>

                  <label className="settings-row">
                    <span>Sidebar density</span>
                    <select
                      value={settings.sidebarDensity}
                      onChange={(e) =>
                        onChangeSettings({
                          sidebarDensity: e.target.value as AppSettings['sidebarDensity']
                        })
                      }
                    >
                      <option value="comfortable">Comfortable</option>
                      <option value="compact">Compact</option>
                    </select>
                  </label>

                  <label className="settings-row">
                    <span>Desktop notifications</span>
                    <input
                      type="checkbox"
                      checked={settings.notificationsEnabled}
                      onChange={(e) => onChangeSettings({ notificationsEnabled: e.target.checked })}
                    />
                  </label>

                  <label className="settings-row">
                    <span>Notification sound (beep on new unread)</span>
                    <input
                      type="checkbox"
                      checked={settings.notificationSound}
                      onChange={(e) => onChangeSettings({ notificationSound: e.target.checked })}
                    />
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => {
                        void window.api.app.testNotification().then((r) => {
                          window.alert(r.message)
                        })
                      }}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      🔔 Send test notification
                    </button>
                  </div>

                  <label className="settings-row">
                    <span>Lock after idle (minutes)</span>
                    <input
                      type="number"
                      min={1}
                      max={240}
                      value={settings.idleLockMinutes}
                      onChange={(e) => onChangeSettings({ idleLockMinutes: Number(e.target.value) || 15 })}
                    />
                  </label>

                  <label className="settings-row">
                    <span>Sleep inactive embeds (minutes, 0=off)</span>
                    <input
                      type="number"
                      min={0}
                      max={240}
                      value={settings.idleSleepMinutes}
                      onChange={(e) => onChangeSettings({ idleSleepMinutes: Number(e.target.value) || 0 })}
                    />
                  </label>

                  <label className="settings-row">
                    <span>Split view enabled</span>
                    <input
                      type="checkbox"
                      checked={settings.splitViewEnabled}
                      onChange={(e) => onChangeSettings({ splitViewEnabled: e.target.checked })}
                    />
                  </label>

                  <label className="settings-row">
                    <span>
                      Show scraping progress line in cards
                      <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                        Displays real-time channel &amp; message reader progress above embedded workspace views
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.showScrapeProgressLine ?? true}
                      onChange={(e) => onChangeSettings({ showScrapeProgressLine: e.target.checked })}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB: SIDEBAR & NAVIGATION */}
            {activeTab === 'sidebar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <header>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>
                    Sidebar & Navigation
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Customize which sections, looks, and buttons appear in the sidebar navigation rail.
                  </p>
                </header>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    background: 'rgba(15, 23, 42, 0.4)',
                    padding: '20px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  {/* Subsection 1: Appearance Look */}
                  <div>
                    <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#e2e8f0', fontWeight: 600 }}>
                      Appearance Look &amp; Header
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label className="settings-row">
                        <span>Default Appearance Look</span>
                        <select
                          value={settings.sidebarLook ?? 'ancient'}
                          onChange={(e) =>
                            onChangeSettings({
                              sidebarLook: e.target.value as 'minimal' | 'ancient' | 'new-cosmic'
                            })
                          }
                        >
                          <option value="minimal">Minimal Look (Clean &amp; compact)</option>
                          <option value="ancient">Ancient Look (Default established theme)</option>
                          <option value="new-cosmic">New Cosmic (Futuristic exploration)</option>
                        </select>
                      </label>

                      <label className="settings-row">
                        <span>Show Look Switcher in Sidebar Header</span>
                        <input
                          type="checkbox"
                          checked={settings.showLookSwitcher ?? true}
                          onChange={(e) =>
                            onChangeSettings({ showLookSwitcher: e.target.checked })
                          }
                        />
                      </label>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: 0 }} />

                  {/* Subsection 2: Content Sections */}
                  <div>
                    <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#e2e8f0', fontWeight: 600 }}>
                      Navigation Sections
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="settings-row" style={{ opacity: 0.9 }}>
                        <span>
                          Dashboard &amp; Projects
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                            Permanent anchor — always visible
                          </span>
                        </span>
                        <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 600 }}>Permanent</span>
                      </div>

                      <label className="settings-row">
                        <span>
                          Show Recent Workspaces
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                            Quick access strip showing recently active workspaces below Dashboard
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.showRecentSection ?? true}
                          onChange={(e) =>
                            onChangeSettings({ showRecentSection: e.target.checked })
                          }
                        />
                      </label>

                      <label className="settings-row">
                        <span>
                          Show Google Email Sign-In in Sidebar
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                            Display Google email input and Continue with Google button in the left sidebar
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.showGoogleEmailInputInSidebar ?? true}
                          onChange={(e) =>
                            onChangeSettings({ showGoogleEmailInputInSidebar: e.target.checked })
                          }
                        />
                      </label>

                      <label className="settings-row">
                        <span>
                          Show Account Scope Selector in Profile Modal
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                            Display Both / Global / Individual scope chips in the Add Profile dialog (defaults to Both when off)
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.showProfileScopeSelector ?? false}
                          onChange={(e) =>
                            onChangeSettings({ showProfileScopeSelector: e.target.checked })
                          }
                        />
                      </label>

                      <label className="settings-row">
                        <span>
                          Show "Observer View" Header in Sidebar
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                            Display a subtle "OBSERVER VIEW" divider label above the bottom 6 sidebar action buttons
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.showObserverViewHeader ?? false}
                          onChange={(e) =>
                            onChangeSettings({ showObserverViewHeader: e.target.checked })
                          }
                        />
                      </label>

                      <label className="settings-row">
                        <span>
                          Show &quot;Profile&quot; Navigation Button
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                            Show the &quot;All Profiles&quot; (or &quot;Profile&quot;) quick navigation button in the sidebar
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.showSidebarProfileNavButton ?? settings.showCosmicProfileNavButtons ?? true}
                          onChange={(e) =>
                            onChangeSettings({
                              showSidebarProfileNavButton: e.target.checked
                            })
                          }
                        />
                      </label>

                      <label className="settings-row">
                        <span>
                          Show &quot;Dashboard&quot; Navigation Button
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                            Show the &quot;Full Dashboard&quot; (or &quot;Dashboard&quot;) quick navigation button in the sidebar
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.showSidebarDashboardNavButton ?? settings.showCosmicProfileNavButtons ?? true}
                          onChange={(e) =>
                            onChangeSettings({
                              showSidebarDashboardNavButton: e.target.checked
                            })
                          }
                        />
                      </label>

                      <label className="settings-row">
                        <span>
                          Show Quick Actions on Sidebar Items
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                            Show hide (👁) and remove (×) action buttons when hovering over custom links in the sidebar
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.showSidebarItemActions ?? true}
                          onChange={(e) =>
                            onChangeSettings({ showSidebarItemActions: e.target.checked })
                          }
                        />
                      </label>

                      <label className="settings-row">
                        <span>
                          Show "Hide" Button on Profile Headers in Sidebar
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                            Display the eye hide button (👁) next to profile names in the main sidebar. Disabled by default to prevent accidental profile hiding.
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={settings.showSidebarProfileHideButton ?? false}
                          onChange={(e) =>
                            onChangeSettings({ showSidebarProfileHideButton: e.target.checked })
                          }
                        />
                      </label>

                      <div className="settings-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <span>Base Default Apps Layout</span>
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                            Choose the default messaging apps and tools shown when creating accounts
                          </span>
                        </div>
                        <select
                          value={settings.baseAppLayout ?? 'standard'}
                          onChange={(e) =>
                            onChangeSettings({
                              baseAppLayout: e.target.value as 'none' | 'standard' | 'extended' | 'full'
                            })
                          }
                          style={{
                            background: '#0f172a',
                            color: '#f8fafc',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="none">Option 0: Minimal (No default apps — show only added websites)</option>
                          <option value="standard">Option 1 (Default): Standard 3 apps (Slack, Teams, WhatsApp)</option>
                          <option value="extended">Option 2: Extended (Slack, Teams, WhatsApp + Claude, ChatGPT)</option>
                          <option value="full">Option 3: All-in-One (Slack, Teams, WhatsApp + 6 top tools)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: 0 }} />

                  {/* Subsection 3: Bottom Action Buttons */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', color: '#e2e8f0', fontWeight: 600 }}>
                        Sidebar Bottom Action Buttons
                      </h4>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        Grid automatically adjusts layout based on active buttons
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="settings-row" style={{ opacity: 0.9 }}>
                        <span>
                          ⚙️ Settings Button
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                            Permanent anchor — opens this Global Settings Hub
                          </span>
                        </span>
                        <span style={{ fontSize: '11px', color: '#4ade80', fontWeight: 600 }}>Permanent</span>
                      </div>

                      <label className="settings-row">
                        <span>🌐 + Website (Add Platform &amp; Custom Web Links)</span>
                        <input
                          type="checkbox"
                          checked={settings.sidebarButtons?.addWebsite ?? true}
                          onChange={(e) =>
                            onChangeSettings({
                              sidebarButtons: {
                                ...(settings.sidebarButtons ?? {
                                  addWebsite: true,
                                  newProject: true,
                                  newProfile: true,
                                  observer: true,
                                  profilesHub: true
                                }),
                                addWebsite: e.target.checked
                              }
                            })
                          }
                        />
                      </label>

                      <label className="settings-row">
                        <span>📁 + Project (Create Project / Workspace)</span>
                        <input
                          type="checkbox"
                          checked={settings.sidebarButtons?.newProject ?? true}
                          onChange={(e) =>
                            onChangeSettings({
                              sidebarButtons: {
                                ...(settings.sidebarButtons ?? {
                                  addWebsite: true,
                                  newProject: true,
                                  newProfile: true,
                                  observer: true,
                                  profilesHub: true
                                }),
                                newProject: e.target.checked
                              }
                            })
                          }
                        />
                      </label>

                      <label className="settings-row">
                        <span>👤 + Profile (Create Profile / Account)</span>
                        <input
                          type="checkbox"
                          checked={settings.sidebarButtons?.newProfile ?? true}
                          onChange={(e) =>
                            onChangeSettings({
                              sidebarButtons: {
                                ...(settings.sidebarButtons ?? {
                                  addWebsite: true,
                                  newProject: true,
                                  newProfile: true,
                                  observer: true,
                                  profilesHub: true
                                }),
                                newProfile: e.target.checked
                              }
                            })
                          }
                        />
                      </label>

                      <label className="settings-row">
                        <span>🔭 Observer (Live Workspace &amp; Observer View)</span>
                        <input
                          type="checkbox"
                          checked={settings.sidebarButtons?.observer ?? true}
                          onChange={(e) =>
                            onChangeSettings({
                              sidebarButtons: {
                                ...(settings.sidebarButtons ?? {
                                  addWebsite: true,
                                  newProject: true,
                                  newProfile: true,
                                  observer: true,
                                  profilesHub: true
                                }),
                                observer: e.target.checked
                              }
                            })
                          }
                        />
                      </label>

                      <label className="settings-row">
                        <span>👥 Profiles (Profiles &amp; Accounts Management Hub)</span>
                        <input
                          type="checkbox"
                          checked={settings.sidebarButtons?.profilesHub ?? true}
                          onChange={(e) =>
                            onChangeSettings({
                              sidebarButtons: {
                                ...(settings.sidebarButtons ?? {
                                  addWebsite: true,
                                  newProject: true,
                                  newProfile: true,
                                  observer: true,
                                  profilesHub: true
                                }),
                                profilesHub: e.target.checked
                              }
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: GLOBAL AI & NVIDIA */}
            {activeTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <header>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>
                    Global AI & NVIDIA NIM
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    One global API key and default models for cards that do not specify individual overrides.
                  </p>
                </header>

                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.4)',
                    padding: '20px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <AiSettingsForm />

                  <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <h5 style={{ margin: '0 0 10px', fontSize: '13px', color: '#cbd5e1' }}>Usage Overview</h5>
                    <div className="global-config-usage">
                      <div>
                        <b>{globalConfig?.usage.projects ?? 0}</b>
                        <span>projects</span>
                      </div>
                      <div>
                        <b>{globalConfig?.usage.usingGlobalAi ?? 0}</b>
                        <span>using global NVIDIA</span>
                      </div>
                      <div>
                        <b>{globalConfig?.usage.usingGlobalOurSlack ?? 0}</b>
                        <span>using global Our Slack</span>
                      </div>
                    </div>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '8px 0 0' }}>
                      Status: <span style={{ color: '#4ade80' }}>{nvidiaStatus}</span>
                      {globalConfig?.nvidia.apiKeyMask ? ` (${globalConfig.nvidia.apiKeyMask})` : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: OUR SLACK */}
            {activeTab === 'our_slack' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <header>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>
                    Team Slack (Our Slack)
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Your central agency workspace connected once across all project cards.
                  </p>
                </header>

                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.4)',
                    padding: '20px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <TeamSlackSettings />
                </div>
              </div>
            )}

            {/* TAB: ACCOUNTS & WORKSPACES */}
            {activeTab === 'accounts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>
                      Accounts & Workspaces Hub
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                      Manage connected accounts, workspace sidebar visibility, and custom links.
                    </p>
                  </div>
                  {onAddGoogleAccount && (
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={onAddGoogleAccount}
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                    >
                      + Add Google Account
                    </button>
                  )}
                </header>

                {errorMsg && (
                  <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: 6, fontSize: 13 }}>
                    {errorMsg}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {profiles.map((profile) => (
                    <div
                      key={profile.id}
                      style={{
                        padding: '16px',
                        background: 'rgba(15, 23, 42, 0.4)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '16px' }}>👤</span>
                          <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '14px' }}>
                            {profile.displayName || profile.id}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => void handleToggleSidebarVisibility(profile)}
                          style={{ fontSize: '12px', padding: '4px 10px', color: profile.hiddenInSidebar ? '#94a3b8' : '#60a5fa' }}
                        >
                          {profile.hiddenInSidebar ? '👁️ Show in Sidebar' : '👁️‍🗨️ Hide from Sidebar'}
                        </button>
                      </div>

                      {/* Custom Links for this profile */}
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Custom Web Apps & Links:</span>
                          <button
                            type="button"
                            className="btn ghost"
                            onClick={() => setAddingLinkForProfileId(addingLinkForProfileId === profile.id ? null : profile.id)}
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                          >
                            + Add Link
                          </button>
                        </div>

                        {addingLinkForProfileId === profile.id && (
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                            <input
                              type="text"
                              placeholder="Name (e.g. Jira)"
                              value={customName}
                              onChange={(e) => setCustomName(e.target.value)}
                              style={{ flex: 1, padding: '6px 10px', fontSize: '12px', background: '#020617', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff', borderRadius: 4 }}
                            />
                            <input
                              type="text"
                              placeholder="URL (https://...)"
                              value={customUrl}
                              onChange={(e) => setCustomUrl(e.target.value)}
                              style={{ flex: 2, padding: '6px 10px', fontSize: '12px', background: '#020617', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#fff', borderRadius: 4 }}
                            />
                            <button
                              type="button"
                              className="btn primary"
                              onClick={() => void handleAddCustomLink(profile.id)}
                              style={{ fontSize: '12px', padding: '6px 12px' }}
                            >
                              Save
                            </button>
                          </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {(!profile.customLinks || profile.customLinks.length === 0) && (
                            <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>No custom links added.</span>
                          )}
                          {(profile.customLinks ?? []).map((link) => (
                            <div
                              key={link.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '4px',
                                fontSize: '12px'
                              }}
                            >
                              <span style={{ color: '#f8fafc' }}>{link.name}</span>
                              <button
                                type="button"
                                onClick={() => void handleToggleLinkVisibility(profile.id, link)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: link.hiddenInSidebar ? 0.4 : 1 }}
                                title={link.hiddenInSidebar ? 'Hidden in sidebar' : 'Visible in sidebar'}
                              >
                                {link.hiddenInSidebar ? '🔒' : '👁️'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRemoveCustomLink(profile.id, link.id)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                title="Remove link"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: SYSTEM & MAINTENANCE */}
            {activeTab === 'maintenance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <header>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc' }}>
                    System & Maintenance
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
                    Profile backup, updates, session resets, and admin credential control.
                  </p>
                </header>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    background: 'rgba(15, 23, 42, 0.4)',
                    padding: '20px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <div className="settings-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={onExportProfiles}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      📦 Export profiles & configuration
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={onImportProfiles}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      📥 Import profiles & configuration
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => {
                        void window.api.app.checkUpdates().then((r) => {
                          window.alert(r.message)
                        })
                      }}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      🔄 Check for updates
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => {
                        if (
                          window.confirm(
                            'Remove all profiles and their local sessions? This cannot be undone.'
                          )
                        ) {
                          onClearAllProfiles()
                        }
                      }}
                      style={{ width: '100%', justifyContent: 'center', color: '#ef4444' }}
                    >
                      ⚠️ Remove all profiles & sessions
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={onAdminLogout}
                      style={{ width: '100%', justifyContent: 'center', color: '#ef4444' }}
                    >
                      🚪 Sign out admin
                    </button>
                  </div>
                  <p className="settings-hint" style={{ marginTop: '10px' }}>
                    {modKey()}, opens settings anytime · All credentials stay secure on local machine.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
