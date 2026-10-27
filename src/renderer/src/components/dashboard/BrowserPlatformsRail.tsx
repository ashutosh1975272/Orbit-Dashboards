import React, { useEffect, useState } from 'react'
import type {
  AddBrowserPlatformInput,
  BrowserPlatformConfig
} from '../../../../shared/browser-sources-contract'
import { AddPlatformModal } from './AddPlatformModal'

interface BrowserPlatformsRailProps {
  activePlatformId?: string | null
  onSelectPlatform: (platform: BrowserPlatformConfig) => void
  onPlatformRemoved?: (id: string) => void
}

function getPlatformIcon(type: string): string {
  switch (type) {
    case 'slack':
      return '💬'
    case 'teams':
      return '👥'
    case 'whatsapp':
      return '📱'
    case 'discord':
      return '🎮'
    case 'upwork':
      return '💼'
    default:
      return '🔗'
  }
}

function statusClass(status: string): string {
  if (status === 'logged_in') return 'is-logged-in'
  if (status === 'adapter_broken') return 'is-broken'
  if (status === 'paused') return 'is-paused'
  return 'is-needs-login'
}

function statusLabel(status: string): string {
  if (status === 'logged_in') return 'Logged in'
  if (status === 'adapter_broken') return 'Adapter broken'
  if (status === 'paused') return 'Paused'
  return 'Needs login'
}

function StatusIndicator({ status }: { status: string }): React.JSX.Element {
  const label = statusLabel(status)
  return <span className={`bs-status ${statusClass(status)}`} title={label} aria-label={label} />
}

export const BrowserPlatformsRail: React.FC<BrowserPlatformsRailProps> = ({
  activePlatformId,
  onSelectPlatform,
  onPlatformRemoved
}) => {
  const [platforms, setPlatforms] = useState<BrowserPlatformConfig[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)

  const reloadPlatforms = async (): Promise<void> => {
    if (typeof window.api?.browserSources?.list === 'function') {
      try {
        const list = await window.api.browserSources.list()
        setPlatforms(list)
      } catch {
        /* ignore */
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    window.api?.browserSources
      ?.list?.()
      .then((list) => {
        if (!cancelled) setPlatforms(list)
      })
      .catch(() => {
        /* ignore */
      })

    const unsub = window.api?.browserSources?.onStatusChanged?.((event) => {
      setPlatforms((prev) =>
        prev.map((p) =>
          p.id === event.platformId
            ? {
                ...p,
                authStatus: event.authStatus,
                lastCheckedAt: event.lastCheckedAt,
                errorMessage: event.errorMessage
              }
            : p
        )
      )
    })

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  const handleOpenModal = (): void => {
    setIsModalOpen(true)
    // Native WebContentsViews paint above the renderer, so hide the active
    // source while the modal is open instead of letting it cover the dialog.
    void window.api?.browserSources?.setEmbedVisible?.(false)
  }

  const handleCloseModal = (): void => {
    setIsModalOpen(false)
    if (activePlatformId) {
      void window.api?.browserSources?.setEmbedVisible?.(true)
    }
  }

  const handleAddPlatform = async (input: AddBrowserPlatformInput): Promise<void> => {
    if (typeof window.api?.browserSources?.add === 'function') {
      await window.api.browserSources.add(input)
      await reloadPlatforms()
    }
  }

  const handleRemove = async (id: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    const confirmed = window.confirm(
      'Remove this browser platform and clear its saved session data?'
    )
    if (!confirmed) return

    if (typeof window.api?.browserSources?.remove === 'function') {
      await window.api.browserSources.remove(id, true)
      await reloadPlatforms()
      if (activePlatformId === id) {
        onPlatformRemoved?.(id)
      }
    }
  }

  return (
    <div className="dash-browser-sources" data-testid="browser-platforms-rail">
      <div className="bs-rail-head">
        <span className="bs-rail-title">Browser Sources</span>
        <button
          type="button"
          onClick={handleOpenModal}
          className="bs-add-btn"
          data-testid="add-platform-btn"
          title="Add Browser Source (Slack, Teams, WhatsApp, Custom Link)"
        >
          + Add
        </button>
      </div>

      <div className="bs-list">
        {platforms.map((p) => {
          const isActive = activePlatformId === p.id
          return (
            <div
              key={p.id}
              className={`bs-row${isActive ? ' is-active' : ''}`}
              onClick={() => onSelectPlatform(p)}
              data-testid={`browser-platform-${p.id}`}
              role="button"
              tabIndex={0}
              aria-current={isActive ? 'true' : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelectPlatform(p)
                }
              }}
            >
              <span className="bs-row-icon" aria-hidden>
                {getPlatformIcon(p.type)}
              </span>
              <span className="bs-row-name">{p.name}</span>

              <span className="bs-row-actions">
                <StatusIndicator status={p.authStatus} />
                <button
                  type="button"
                  onClick={(e) => void handleRemove(p.id, e)}
                  className="bs-remove"
                  title="Remove platform"
                  aria-label={`Remove ${p.name}`}
                >
                  ✕
                </button>
              </span>
            </div>
          )
        })}

        {platforms.length === 0 && (
          <div className="bs-empty">
            No browser sources added. Click &quot;+ Add&quot; to connect client web sessions.
          </div>
        )}
      </div>

      <AddPlatformModal isOpen={isModalOpen} onClose={handleCloseModal} onAdd={handleAddPlatform} />
    </div>
  )
}
