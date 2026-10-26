import React, { useState } from 'react'
import type {
  AddBrowserPlatformInput,
  BrowserPlatformType
} from '../../../../shared/browser-sources-contract'

interface AddPlatformModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (input: AddBrowserPlatformInput) => Promise<void>
}

const PRESETS: Array<{
  type: BrowserPlatformType
  title: string
  defaultName: string
  defaultUrl: string
  description: string
  icon: string
}> = [
  {
    type: 'slack',
    title: 'Slack Web',
    defaultName: 'Client Slack',
    defaultUrl: 'https://app.slack.com/client/',
    description: 'Login to client workspace via web without installing local app',
    icon: '💬'
  },
  {
    type: 'teams',
    title: 'Microsoft Teams',
    defaultName: 'Client Teams',
    defaultUrl: 'https://teams.microsoft.com/v2/',
    description: 'Microsoft Teams v2 web client session',
    icon: '👥'
  },
  {
    type: 'whatsapp',
    title: 'WhatsApp Web',
    defaultName: 'WhatsApp',
    defaultUrl: 'https://web.whatsapp.com/',
    description: 'Read-only web session for client communication',
    icon: '📱'
  },
  {
    type: 'upwork',
    title: 'Upwork Messages',
    defaultName: 'Upwork Client',
    defaultUrl: 'https://www.upwork.com/messages/',
    description: 'Direct client communication thread on Upwork',
    icon: '💼'
  },
  {
    type: 'discord',
    title: 'Discord Web',
    defaultName: 'Discord Server',
    defaultUrl: 'https://discord.com/app',
    description: 'Discord web client communication',
    icon: '🎮'
  },
  {
    type: 'custom',
    title: 'Custom Link',
    defaultName: 'Custom Portal',
    defaultUrl: 'https://',
    description: 'Any secure web link (portal, client tracker, dashboard)',
    icon: '🔗'
  }
]

export const AddPlatformModal: React.FC<AddPlatformModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [selectedType, setSelectedType] = useState<BrowserPlatformType>('slack')
  const [name, setName] = useState('Client Slack')
  const [url, setUrl] = useState('https://app.slack.com/client/')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSelectPreset = (preset: (typeof PRESETS)[0]): void => {
    setSelectedType(preset.type)
    setName(preset.defaultName)
    setUrl(preset.defaultUrl)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    const trimmedUrl = url.trim()

    if (!trimmedName) {
      setError('Platform name is required')
      return
    }

    if (!trimmedUrl || !trimmedUrl.startsWith('https://')) {
      setError('A secure HTTPS URL is required')
      return
    }

    try {
      setIsSubmitting(true)
      await onAdd({
        name: trimmedName,
        type: selectedType,
        url: trimmedUrl
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to add platform')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      data-testid="add-platform-modal"
    >
      <div className="w-full max-w-lg rounded-xl border border-border-dark bg-[#181a20] p-6 shadow-2xl text-text-dark space-y-5">
        <div className="flex items-center justify-between border-b border-border-dark pb-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Add Browser Source</h2>
            <p className="text-xs text-muted-dark">
              Tab-less native web session for reading client messages & updates
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-dark hover:text-white transition-colors text-lg px-2"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Preset choices */}
        <div className="grid grid-cols-2 gap-2.5">
          {PRESETS.map((p) => {
            const isSelected = selectedType === p.type
            return (
              <button
                key={p.type}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-accent bg-accent/10 shadow-sm'
                    : 'border-border-dark/60 bg-[#121418] hover:border-border-dark hover:bg-[#15171d]'
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {p.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{p.title}</div>
                  <div className="text-[11px] text-muted-dark line-clamp-1">{p.description}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* WhatsApp Callout */}
        {selectedType === 'whatsapp' && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90 leading-relaxed">
            <strong>Strict Read-Only Mode:</strong> WhatsApp Web adapter is permanently read-only.
            No automated writing or sending tools will be registered to minimize ban risks.
          </div>
        )}

        {/* Form fields */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-dark mb-1">
              Platform Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Client Slack"
              className="w-full px-3 py-2 rounded-lg bg-[#0e1014] border border-border-dark text-sm text-white focus:outline-none focus:border-accent"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-dark mb-1">
              URL (HTTPS)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://app.slack.com/client/..."
              className="w-full px-3 py-2 rounded-lg bg-[#0e1014] border border-border-dark text-sm text-white font-mono focus:outline-none focus:border-accent"
              required
            />
          </div>

          {error && <div className="text-xs text-rose-400 font-medium">{error}</div>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border-dark text-xs text-muted-dark hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Adding…' : 'Add Platform'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

