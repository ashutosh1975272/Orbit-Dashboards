import React, { useEffect, useState } from 'react'
import type {
  AddBrowserPlatformInput,
  BrowserPlatformConfig
} from '../../../../shared/browser-sources-contract'
import { AddPlatformModal } from './AddPlatformModal'

interface BrowserPlatformsRailProps {
  activePlatformId?: string | null
  onSelectPlatform: (platform: BrowserPlatformConfig) => void
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

function StatusIndicator({ status }: { status: string }): React.JSX.Element {
  if (status === 'logged_in') {
    return (
      <span
        className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0 shadow-sm shadow-emerald-500/50"
        title="Logged in"
        aria-label="Logged in"
      />
    )
  }
  if (status === 'adapter_broken') {
    return (
      <span
        className="w-2 h-2 rounded-full bg-rose-500 inline-block shrink-0 shadow-sm shadow-rose-500/50"
        title="Adapter broken"
        aria-label="Adapter broken"
      />
    )
  }
  return (
    <span
      className="w-2 h-2 rounded-full bg-amber-400 inline-block shrink-0 shadow-sm shadow-amber-400/50"
      title="Needs login"
      aria-label="Needs login"
    />
  )
}

export const BrowserPlatformsRail: React.FC<BrowserPlatformsRailProps> = ({
  activePlatformId,
  onSelectPlatform
}) => {
  const [platforms, setPlatforms] = useState<BrowserPlatformConfig[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [menuPlatformId, setMenuPlatformId] = useState<string | null>(null)

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
    void reloadPlatforms()

    const unsub = window.api?.browserSources?.onStatusChanged?.((event) => {
      setPlatforms((prev) =>
        prev.map((p) =>
          p.id === event.platformId
            ? { ...p, authStatus: event.authStatus, lastCheckedAt: event.lastCheckedAt }
            : p
        )
      )
    })

    return () => {
      unsub?.()
    }
  }, [])

  const handleAddPlatform = async (input: AddBrowserPlatformInput): Promise<void> => {
    if (typeof window.api?.browserSources?.add === 'function') {
      const added = await window.api.browserSources.add(input)
      await reloadPlatforms()
      onSelectPlatform(added)
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
      if (menuPlatformId === id) setMenuPlatformId(null)
    }
  }

  return (
    <div className="dash-browser-sources mt-3 pt-3 border-t border-border-dark/40" data-testid="browser-platforms-rail">
      <div className="flex items-center justify-between px-3 py-1 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-dark">
          Browser Sources
        </span>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="text-xs text-muted-dark hover:text-accent font-semibold px-1.5 py-0.5 rounded transition-colors"
          data-testid="add-platform-btn"
          title="Add Browser Source (Slack, Teams, WhatsApp, Custom Link)"
        >
          + Add
        </button>
      </div>

      <div className="space-y-0.5">
        {platforms.map((p) => {
          const isActive = activePlatformId === p.id
          return (
            <div
              key={p.id}
              className={`group relative flex items-center justify-between px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                isActive
                  ? 'bg-accent/15 text-white font-medium'
                  : 'text-text-dark/80 hover:bg-white/5 hover:text-white'
              }`}
              onClick={() => onSelectPlatform(p)}
              data-testid={`browser-platform-${p.id}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm" aria-hidden>
                  {getPlatformIcon(p.type)}
                </span>
                <span className="text-xs truncate">{p.name}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <StatusIndicator status={p.authStatus} />
                <button
                  type="button"
                  onClick={(e) => void handleRemove(p.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-muted-dark hover:text-rose-400 text-xs px-1 transition-opacity"
                  title="Remove platform"
                  aria-label="Remove platform"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        })}

        {platforms.length === 0 && (
          <div className="px-3 py-2 text-[11px] text-muted-dark/70 italic">
            No browser sources added. Click &quot;+ Add&quot; to connect client web sessions.
          </div>
        )}
      </div>

      <AddPlatformModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddPlatform}
      />
    </div>
  )
}
