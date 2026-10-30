import React, { useMemo, useState } from 'react'
import { useProfileStore } from '../../hooks/useProfiles'

export type ProfileCreationMode = 'under_global' | 'individual' | 'both'

interface NewProfileModalProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, email: string, mode: ProfileCreationMode) => Promise<void>
}

export function NewProfileModal({ open, onClose, onCreate }: NewProfileModalProps): React.JSX.Element | null {
  const profiles = useProfileStore((s) => s.profiles)
  const [mode, setMode] = useState<ProfileCreationMode>('both')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if email already matches an existing profile
  const existingProfile = useMemo(() => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) return null
    return profiles.find((p) => p.displayName.trim().toLowerCase() === trimmed) || null
  }, [email, profiles])

  if (!open) return null

  const handleClose = () => {
    setName('')
    setEmail('')
    setMode('both')
    setError(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please enter a name for this profile or account')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onCreate(name.trim(), email.trim(), mode)
      handleClose()
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
        if (e.target === e.currentTarget) handleClose()
      }}
      style={{ zIndex: 1300 }}
    >
      <div
        className="platform-settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Add Profile or Account"
        style={{
          width: '560px',
          maxWidth: '94vw',
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
            onClick={handleClose}
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

          {/* Mode Selector: 3 Creation Scopes (Both, Global, Individual) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#cbd5e1' }}>
                Account Creation Scope:
              </label>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                (Observer is managed from sidebar)
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setMode('both')}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: mode === 'both' ? '1.5px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.12)',
                  background: mode === 'both' ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'rgba(255, 255, 255, 0.03)',
                  color: mode === 'both' ? '#fff' : '#94a3b8',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px', color: mode === 'both' ? '#fff' : '#cbd5e1' }}>
                  🌟 Both (Recommended)
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.3 }}>
                  Usable in both Global pool & Individual project list.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('under_global')}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: mode === 'under_global' ? '1.5px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.12)',
                  background: mode === 'under_global' ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'rgba(255, 255, 255, 0.03)',
                  color: mode === 'under_global' ? '#fff' : '#94a3b8',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px', color: mode === 'under_global' ? '#fff' : '#cbd5e1' }}>
                  🌐 Global Accounts
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.3 }}>
                  Shared company pool for all project cards.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('individual')}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: mode === 'individual' ? '1.5px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.12)',
                  background: mode === 'individual' ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'rgba(255, 255, 255, 0.03)',
                  color: mode === 'individual' ? '#fff' : '#94a3b8',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px', color: mode === 'individual' ? '#fff' : '#cbd5e1' }}>
                  👤 Individual Only
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.3 }}>
                  Dedicated client profile that owns cards.
                </div>
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
              Account / Profile Name
            </label>
            <input
              type="text"
              placeholder="e.g. Ashutosh, Agency Global, Client Team"
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

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="e.g. name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                background: '#020617',
                border: existingProfile ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
                color: '#fff',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
            />
            {existingProfile ? (
              <span style={{ fontSize: '12px', color: '#38bdf8', marginTop: '4px', display: 'block' }}>
                ℹ️ This email is already connected as &ldquo;{existingProfile.customName || existingProfile.displayName}&rdquo;. Submitting will update its scope and profile name.
              </span>
            ) : (
              <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Chrome will open to verify Google session and 2SV before activating.
              </span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={submitting}>
              {submitting ? 'Connecting…' : existingProfile ? 'Update & Link Account' : 'Add Account & Verify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
