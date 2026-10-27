import React from 'react'
import {
  SidebarLayout,
  LayoutMode,
  SIDEBAR_REGISTRY
} from './sidebar-layout'

interface SidebarLayoutTabProps {
  layout: SidebarLayout
  onModeChange: (mode: LayoutMode) => void
  onToggleSection: (sectionKey: string) => void
  onReset: () => void
}

function sectionIcon(key: string): string {
  switch (key) {
    case 'dashboard':
      return '▦'
    case 'xomni':
      return '✦'
    case 'slack':
      return '#'
    case 'info':
      return 'ℹ'
    case 'viz':
      return '▤'
    case 'settings':
      return '⚙'
    default:
      return '•'
  }
}

export function SidebarLayoutView({
  layout,
  onModeChange,
  onToggleSection,
  onReset
}: SidebarLayoutTabProps): React.ReactElement {
  const nonLocked = SIDEBAR_REGISTRY.filter((s) => !s.locked)
  const hidden = new Set(layout.custom.hiddenSections)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <p
          style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--text-muted)',
            margin: '0 0 8px'
          }}
        >
          Layout mode
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
          Choose what appears in the card&apos;s left sidebar.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { key: 'minimal', label: 'Minimal', desc: 'Dashboard only', icon: 'dashboard' },
            { key: 'full', label: 'Full', desc: 'Everything', icon: 'slack' },
            { key: 'custom', label: 'Custom', desc: 'Your own arrangement', icon: 'settings' }
          ].map((m) => {
            const selected = layout.mode === m.key
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => onModeChange(m.key as LayoutMode)}
                style={{
                  flex: 1,
                  padding: '16px',
                  borderRadius: '12px',
                  border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: selected ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: selected ? 'var(--accent)' : 'var(--text)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{m.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.desc}</div>
                <div style={{ marginTop: 'auto', fontSize: '14px' }}>{sectionIcon(m.icon)}</div>
              </button>
            )
          })}
        </div>
      </div>

      {layout.mode === 'custom' && (
        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <p
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--text-muted)',
                margin: 0
              }}
            >
              Arrange
            </p>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>(Custom only)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {nonLocked.map((section) => {
                const isHidden = hidden.has(section.key)
                return (
                  <button
                    key={section.key}
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: isHidden ? 'var(--surface)' : 'var(--hover)',
                      border: `1px solid ${isHidden ? 'var(--border)' : 'var(--border-btn)'}`,
                      cursor: 'pointer'
                    }}
                    onClick={() => onToggleSection(section.key)}
                  >
                    <div
                      style={{
                        fontSize: '13px',
                        color: isHidden ? 'var(--text-muted)' : 'var(--text)',
                        fontWeight: 600,
                        flex: 1,
                        textAlign: 'left'
                      }}
                    >
                      {section.label}
                    </div>
                    <span>{sectionIcon(section.key)}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: isHidden ? 'var(--text-muted)' : 'var(--success)'
                      }}
                    >
                      {isHidden ? 'Hidden' : 'Visible'}
                    </span>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  fontSize: '12.5px',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic'
                }}
              >
                Drag to reorder sections (coming soon)
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: 'var(--text-muted)',
              margin: 0
            }}
          >
            Live preview
          </p>
          <button
            type="button"
            className="dash-subtle"
            style={{ fontSize: '11.5px', padding: '4px 8px' }}
            onClick={onReset}
          >
            Reset layout
          </button>
        </div>
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '14px',
            maxHeight: '180px',
            overflowY: 'auto'
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-faint)',
              marginBottom: '10px'
            }}
          >
            Dashboard (fixed)
          </div>
          {nonLocked.map((section) => {
            const isHidden = hidden.has(section.key)
            if (isHidden) return null
            return (
              <div
                key={section.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 0',
                  fontSize: '12.5px',
                  color: 'var(--text)'
                }}
              >
                <span style={{ opacity: 0.7 }}>{sectionIcon(section.key)}</span>
                <span style={{ fontWeight: 500 }}>{section.label}</span>
              </div>
            )
          })}
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--text-faint)',
              marginTop: '10px'
            }}
          >
            Settings (fixed)
          </div>
        </div>
      </div>
    </div>
  )
}
