import React, { useState } from 'react'

export type ProfileCreationMode = 'under_global' | 'individual'

interface NewProfileModalProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, email: string, mode: ProfileCreationMode) => Promise<void>
}

export function NewProfileModal({ open, onClose, onCreate }: NewProfileModalProps): React.JSX.Element | null {
  const [mode, setMode] = useState<ProfileCreationMode>('under_global')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'individual' && !name.trim()) {
      setError('Please enter an individual profile name')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const finalName = mode === 'under_global' ? 'Global Account' : name.trim()
      await onCreate(finalName, email.trim(), mode)
      setName('')
      setEmail('')
      onClose()
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to create profile')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="platform-settings-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ zIndex: 1300 }}
    >
      <div
        className="platform-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Add Profile or Account"
        style={{
          width: '490px',
          maxWidth: '92vw',
          backgroundColor: '#090d16',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <header
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.6)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>👤</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>
              Add Profile or Account
            </h3>
          </div>
          <button
            type="button"
            className="btn ghost"
            onClick={onClose}
            style={{ color: '#94a3b8', fontSize: '13px' }}
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '6px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {/* Mode Selector: Global Accounts vs Separate Profile */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#cbd5e1' }}>
              Where do you want to add this account?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setMode('under_global')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: mode === 'under_global' ? '1.5px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.12)',
                  background: mode === 'under_global' ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'rgba(255, 255, 255, 0.03)',
                  color: mode === 'under_global' ? '#fff' : '#94a3b8',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', color: mode === 'under_global' ? '#fff' : '#cbd5e1' }}>
                  🌐 Under Global Accounts
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.3 }}>
                  Shared default profile. Workspaces available across all cards.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('individual')}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: mode === 'individual' ? '1.5px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.12)',
                  background: mode === 'individual' ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'rgba(255, 255, 255, 0.03)',
                  color: mode === 'individual' ? '#fff' : '#94a3b8',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', color: mode === 'individual' ? '#fff' : '#cbd5e1' }}>
                  👤 Separate Profile
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.3 }}>
                  Dedicated individual profile (e.g. Ayush, Client). Can own project workspaces.
                </div>
              </button>
            </div>
          </div>

          {mode === 'individual' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                Profile Name
              </label>
              <input
                type="text"
                placeholder="e.g. Ayush, Ashutosh, Work Client"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  background: '#020617',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="e.g. name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus={mode === 'under_global'}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                background: '#020617',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#fff',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
            <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Chrome will open to verify Google session and 2SV before activating.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Connecting…' : mode === 'under_global' ? 'Add Account & Verify' : 'Create Profile & Verify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
