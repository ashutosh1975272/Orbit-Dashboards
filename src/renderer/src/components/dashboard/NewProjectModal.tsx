import React, { useMemo, useState } from 'react'
import { useProfileStore } from '../../hooks/useProfiles'
import { useDashboardStore } from '../../hooks/useDashboard'
import { isIndividualProfile } from '../../../../shared/types'
import type { DashboardProject, ProjectSource } from '../../../../shared/dashboard-contract'
import { CardAddModal } from './CardAddModal'

interface NewProjectModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: (projectId: string) => void
  embedded?: boolean
}

/**
 * Modern 1-page modal dialog / in-place view for project creation:
 * 1. Select Individual Profile (strictly excludes Global Accounts)
 * 2. Enter Project Name
 * 3. Optional '+ Add' button to pick linked accounts (without upfront OAuth)
 * 4. Create Project immediately without blocking popups.
 */
export function NewProjectModal({
  open,
  onClose,
  onSuccess,
  embedded = false
}: NewProjectModalProps): React.JSX.Element | null {
  const profiles = useProfileStore((s) => s.profiles)
  const upsertProject = useDashboardStore((s) => s.upsertProject)
  const syncNow = useDashboardStore((s) => s.syncNow)

  // Filter strictly for Individual Profiles:
  // Must satisfy isIndividualProfile (excludes Rajesh / global accounts)
  const individualProfiles = useMemo(() => {
    return profiles.filter(isIndividualProfile)
  }, [profiles])

  const [selectedProfileId, setSelectedProfileId] = useState<string>(() => {
    return individualProfiles[0]?.id ?? ''
  })
  const [projectName, setProjectName] = useState('')
  const [clientName, setClientName] = useState('')
  const [sources, setSources] = useState<ProjectSource[]>([])
  const [addAccountsOpen, setAddAccountsOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  // Virtual project object to pass into CardAddModal so user can select sources
  const dummyProject: DashboardProject = {
    id: 'draft-project',
    name: projectName.trim() || 'New Project',
    clientName: clientName.trim() || projectName.trim() || 'Client',
    profileId: selectedProfileId || individualProfiles[0]?.id || '',
    teamId: 'T-PENDING',
    teamName: projectName.trim() || 'Workspace',
    appId: 'slack',
    tokenSource: 'oauth',
    sourcePreference: 'browser_only',
    sources: sources,
    monitors: [],
    createdAt: new Date().toISOString()
  }

  const handleCreate = async () => {
    if (!projectName.trim()) {
      setError('Please enter a project name.')
      return
    }
    const profileId = selectedProfileId || individualProfiles[0]?.id
    if (!profileId) {
      setError('Please select or create an individual profile first.')
      return
    }

    setCreating(true)
    setError(null)
    try {
      const newProjectId = `proj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const activeSources = sources.map((s) => ({
        ...s,
        id: `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      }))

      // Pick the primary source or fallback
      const primarySource = activeSources[0]
      const teamId = primarySource?.workspaceId || `team-${Date.now().toString(36)}`
      const teamName = primarySource?.workspaceName || projectName.trim()

      const newProject: DashboardProject = {
        id: newProjectId,
        name: projectName.trim(),
        clientName: clientName.trim() || projectName.trim(),
        profileId,
        teamId,
        teamName,
        appId: 'slack',
        tokenSource: 'oauth',
        sourcePreference: 'browser_only',
        sources: activeSources,
        monitors: [],
        createdAt: new Date().toISOString()
      }

      await upsertProject(newProject)
      void syncNow(newProjectId)
      onSuccess?.(newProjectId)
      onClose()
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const modalContent = (
    <div
      className={embedded ? 'embedded-panel-card' : 'platform-settings-panel'}
      role="dialog"
      aria-modal={!embedded}
      aria-label="Create New Project"
      style={{
        width: embedded ? '100%' : '520px',
        maxWidth: embedded ? '680px' : '92vw',
        backgroundColor: '#0f172a',
        borderRadius: '14px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: embedded ? '0 10px 30px rgba(0, 0, 0, 0.4)' : '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        margin: embedded ? '0 auto' : undefined
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 22px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.02)'
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 650, color: '#f8fafc' }}>
            Create New Project
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            Create a project card inside an individual profile without upfront OAuth blockers.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '4px 8px',
            borderRadius: '6px'
          }}
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '13px'
              }}
            >
              {error}
            </div>
          )}

          {/* 1. Profile Picker */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '6px'
              }}
            >
              Individual Profile (Owner)
            </label>
            {individualProfiles.length === 0 ? (
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#fbbf24',
                  fontSize: '12.5px'
                }}
              >
                No individual profiles available. Please create one using &quot;+ New Profile&quot; in the sidebar first.
              </div>
            ) : (
              <select
                value={selectedProfileId || individualProfiles[0]?.id}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#f8fafc',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
              >
                {individualProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    👤 {p.customName || p.displayName}
                  </option>
                ))}
              </select>
            )}
            <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#64748b' }}>
              Project cards are owned by individual profiles and hidden from the global sidebar.
            </p>
          </div>

          {/* 2. Project Name */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '6px'
              }}
            >
              Project or Workspace Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Acme Redesign, Mobile App v2"
              autoFocus
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                background: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                fontSize: '13.5px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 3. Client Name (Optional) */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '6px'
              }}
            >
              Client Name (Optional)
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Acme Corp (defaults to project name)"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                background: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#f8fafc',
                fontSize: '13.5px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 4. Optional Linked Accounts (+ Add) */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                Linked Workspaces &amp; Accounts ({sources.length})
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                {sources.length > 0
                  ? sources.map((s) => s.workspaceName).join(', ')
                  : 'Optionally link Global Accounts or Client links now, or do it inside the card.'}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setAddAccountsOpen(true)}
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#a5b4fc',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              + Add Accounts
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 22px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={creating}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              color: '#94a3b8',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleCreate()}
            disabled={creating || individualProfiles.length === 0}
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 600,
              background: '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: individualProfiles.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
  )

  if (embedded) {
    return (
      <>
        {modalContent}
        {addAccountsOpen && (
          <CardAddModal
            open={addAccountsOpen}
            project={dummyProject}
            onClose={() => setAddAccountsOpen(false)}
            onSuccess={() => {
              if (dummyProject.sources) {
                setSources([...dummyProject.sources])
              }
            }}
          />
        )}
      </>
    )
  }

  return (
    <div
      className="platform-settings-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !addAccountsOpen) onClose()
      }}
      style={{ zIndex: 1200 }}
    >
      {modalContent}
      {addAccountsOpen && (
        <CardAddModal
          open={addAccountsOpen}
          project={dummyProject}
          onClose={() => setAddAccountsOpen(false)}
          onSuccess={() => {
            if (dummyProject.sources) {
              setSources([...dummyProject.sources])
            }
          }}
        />
      )}
    </div>
  )
}
