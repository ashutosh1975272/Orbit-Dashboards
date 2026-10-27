import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add platform')
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="bs-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bs-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bs-modal-title"
        data-testid="add-platform-modal"
      >
        <div className="bs-modal-head">
          <div>
            <h2 id="bs-modal-title" className="bs-modal-title">
              Add Browser Source
            </h2>
            <p className="bs-modal-sub">
              Tab-less native web session for reading client messages &amp; updates
            </p>
          </div>
          <button type="button" onClick={onClose} className="bs-modal-close" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="bs-preset-grid">
          {PRESETS.map((p) => {
            const isSelected = selectedType === p.type
            return (
              <button
                key={p.type}
                type="button"
                onClick={() => handleSelectPreset(p)}
                aria-pressed={isSelected}
                className={`bs-preset${isSelected ? ' is-selected' : ''}`}
              >
                <span className="bs-preset-icon" aria-hidden>
                  {p.icon}
                </span>
                <span className="bs-preset-copy">
                  <span className="bs-preset-title">{p.title}</span>
                  <span className="bs-preset-desc">{p.description}</span>
                </span>
              </button>
            )
          })}
        </div>

        {selectedType === 'whatsapp' && (
          <div className="bs-callout">
            <strong>Strict Read-Only Mode:</strong> WhatsApp Web adapter is permanently read-only.
            No automated writing or sending tools will be registered to minimize ban risks.
          </div>
        )}

        <form onSubmit={handleSubmit} className="bs-form">
          <div className="bs-field">
            <label className="bs-label" htmlFor="bs-platform-name">
              Platform Name
            </label>
            <input
              id="bs-platform-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Client Slack"
              className="bs-input"
              autoFocus
              required
            />
          </div>

          <div className="bs-field">
            <label className="bs-label" htmlFor="bs-platform-url">
              URL (HTTPS)
            </label>
            <input
              id="bs-platform-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://app.slack.com/client/..."
              className="bs-input bs-input-mono"
              required
            />
          </div>

          {error && (
            <div className="bs-error" role="alert">
              {error}
            </div>
          )}

          <div className="bs-modal-actions">
            <button type="button" onClick={onClose} className="bs-btn bs-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="bs-btn bs-btn-primary">
              {isSubmitting ? 'Adding…' : 'Add Platform'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
