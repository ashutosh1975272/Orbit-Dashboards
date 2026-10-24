import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AiProviderId,
  AiSettingsSource,
  DashboardAiSettingsView
} from '../../../../shared/dashboard-contract'

const KEY_SOURCE_LABEL: Record<AiSettingsSource, string> = {
  project: 'project key',
  global: 'global key',
  env: 'environment key',
  none: 'no key'
}

const MODEL_SOURCE_LABEL: Record<'project' | 'global' | 'env', string> = {
  project: 'Using project settings',
  global: 'Using global',
  env: 'Using environment'
}

interface AiSettingsFormProps {
  /** Omit for the dashboard-level (global) settings. */
  projectId?: string
}

export default function AiSettingsForm({ projectId }: AiSettingsFormProps): React.ReactElement {
  const [view, setView] = useState<DashboardAiSettingsView | null>(null)
  const [useGlobal, setUseGlobal] = useState(true)
  const [provider, setProvider] = useState<AiProviderId>('nvidia-nim')
  const [model, setModel] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [loadingModels, setLoadingModels] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isProject = Boolean(projectId)
  const editable = isProject ? !useGlobal : true

  const loadModels = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.dashboard.listAiModels(projectId ? { projectId } : undefined)
      setModels(result.models)
      setModelsError(result.error ?? null)
    } catch (err) {
      setModels([])
      setModelsError(err instanceof Error ? err.message : 'Could not load models')
    } finally {
      setLoadingModels(false)
    }
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    window.api.dashboard
      .getAiSettings(projectId ? { projectId } : undefined)
      .then((next) => {
        if (cancelled) return
        setView(next)
        setUseGlobal(next.project ? next.project.useGlobal : true)
        setProvider(next.project?.provider ?? next.global.provider)
        setModel(next.project?.model ?? '')
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load AI settings')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    window.api.dashboard
      .listAiModels(projectId ? { projectId } : undefined)
      .then((result) => {
        if (cancelled) return
        setModels(result.models)
        setModelsError(result.error ?? null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setModels([])
        setModelsError(err instanceof Error ? err.message : 'Could not load models')
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false)
      })

    return () => {
      cancelled = true
    }
  }, [projectId])

  const modelOptions = useMemo(() => {
    const all = new Set(models)
    if (view?.effective.model) all.add(view.effective.model)
    const stored = isProject ? view?.project?.model : view?.global.model
    if (stored) all.add(stored)
    return Array.from(all).sort()
  }, [models, view, isProject])

  const storedHasKey = isProject ? Boolean(view?.project?.hasKey) : Boolean(view?.global?.hasKey)
  const storedMask = isProject ? view?.project?.apiKeyMask : view?.global.apiKeyMask

  const effectiveLine = view
    ? `${MODEL_SOURCE_LABEL[view.effective.modelSource]}: ${view.effective.model}`
    : 'Reading settings…'

  const keyHint = ((): string => {
    if (!view) return ''
    if (isProject && useGlobal) {
      if (view.effective.keySource === 'none') return 'No key configured anywhere — AI stays off.'
      return `This project uses the ${KEY_SOURCE_LABEL[view.effective.keySource]} ${view.effective.apiKeyMask ?? ''}`.trim()
    }
    if (storedHasKey) return `Saved: ${storedMask}`
    if (view.effective.keySource === 'env') return 'Using the environment key from .env'
    if (view.effective.keySource !== 'none') {
      return `No key here — falls back to the ${KEY_SOURCE_LABEL[view.effective.keySource]}`
    }
    return 'No key saved yet'
  })()

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const trimmedKey = apiKey.trim()
      const payload = isProject
        ? useGlobal
          ? { projectId, useGlobal: true, provider }
          : {
              projectId,
              useGlobal: false,
              provider,
              model: model.trim() || null,
              ...(trimmedKey ? { apiKey: trimmedKey } : {})
            }
        : {
            provider,
            model: model.trim() || null,
            ...(trimmedKey ? { apiKey: trimmedKey } : {})
          }
      const next = await window.api.dashboard.saveAiSettings(payload)
      setView(next)
      setApiKey('')
      setNotice('Saved')
      setLoadingModels(true)
      await loadModels()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save AI settings')
    } finally {
      setSaving(false)
    }
  }

  const clearKey = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const next = await window.api.dashboard.saveAiSettings(
        isProject ? { projectId, apiKey: null } : { apiKey: null }
      )
      setView(next)
      setNotice('Saved key cleared')
      setLoadingModels(true)
      await loadModels()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear the key')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="ai-settings"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      {isProject ? (
        <label className="ai-settings-toggle">
          <input
            type="checkbox"
            checked={useGlobal}
            onChange={(e) => {
              setUseGlobal(e.target.checked)
              setNotice(null)
            }}
          />
          <span>
            <b>Use global settings</b>
            <small>
              On: this project uses the dashboard key and model. Off: the fields below override
              them.
            </small>
          </span>
        </label>
      ) : null}

      <label className="ai-settings-field">
        <span>Provider</span>
        <select
          value={provider}
          disabled={!editable || saving}
          onChange={(e) => setProvider(e.target.value as AiProviderId)}
        >
          <option value="nvidia-nim">NVIDIA NIM</option>
        </select>
      </label>

      <label className="ai-settings-field">
        <span>Model</span>
        <div className="ai-settings-inline">
          <select
            value={model}
            disabled={!editable || loading || saving}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="">
              {isProject ? 'Inherit from global' : 'Inherit from environment'}
            </option>
            {modelOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="dash-subtle"
            disabled={loadingModels}
            onClick={() => {
              setLoadingModels(true)
              setModelsError(null)
              void loadModels()
            }}
          >
            {loadingModels ? 'Loading…' : '⟳ Models'}
          </button>
        </div>
        {modelsError ? <small className="ai-settings-hint is-error">{modelsError}</small> : null}
      </label>

      <label className="ai-settings-field">
        <span>API key</span>
        <div className="ai-settings-inline">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            disabled={!editable || saving}
            placeholder={storedHasKey ? 'Paste a new key to replace the saved one' : 'nvapi-…'}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button
            type="button"
            className="dash-subtle"
            disabled={!editable}
            onClick={() => setShowKey((prev) => !prev)}
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
        <small className="ai-settings-hint">{keyHint}</small>
      </label>

      <div className="ai-settings-effective" data-testid="ai-effective">
        <span className="ai-settings-label">EFFECTIVE NOW</span>
        <b>{effectiveLine}</b>
        <span className="ai-settings-hint">
          {KEY_SOURCE_LABEL[view?.effective.keySource ?? 'none']}
          {view?.effective.apiKeyMask ? ` ${view.effective.apiKeyMask}` : ''}
        </span>
      </div>

      {error ? <p className="ai-settings-error">{error}</p> : null}
      {notice ? <p className="ai-settings-notice">{notice}</p> : null}

      <div className="ai-settings-actions">
        <button type="submit" className="dash-primary" disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save AI settings'}
        </button>
        {storedHasKey ? (
          <button
            type="button"
            className="dash-subtle"
            disabled={saving}
            onClick={() => void clearKey()}
          >
            {isProject ? 'Clear project key' : 'Clear global key'}
          </button>
        ) : null}
      </div>

      <p className="ai-settings-hint">
        Keys are encrypted with the OS keychain in the main process and never sent back to this
        window — only the mask is shown.
      </p>
    </form>
  )
}
