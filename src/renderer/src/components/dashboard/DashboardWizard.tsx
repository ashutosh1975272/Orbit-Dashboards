import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useDashboardStore } from '../../hooks/useDashboard'

/**
 * Add-project wizard (v2.1 — docs/tickets/dashboard-v2.1.md):
 * Step 1 is a guided setup: create the Slack app (with ready-to-paste manifest),
 * install it to the workspace, copy the xoxp token, then paste it to connect.
 * Steps 2/3: choose channels → confirm card → automatic first sync.
 */

const USER_SCOPES = [
  'channels:read',
  'channels:history',
  'groups:read',
  'groups:history',
  'team:read',
  'users:read',
  'users.profile:read',
  'im:read',
  'im:history',
  'mpim:read',
  'mpim:history',
  'emoji:read'
]

const OPTIONAL_SCOPES = new Set([
  'users:read',
  'users.profile:read',
  'im:read',
  'im:history',
  'mpim:read',
  'mpim:history',
  'emoji:read'
])

const APPS_HOME = 'https://api.slack.com/apps'

function buildManifest(_clientId: string, redirectUri: string): string {
  return JSON.stringify(
    {
      display_information: {
        name: 'Orbit Dashboard Connector',
        description: 'Read-only feed for a client project dashboard',
        background_color: '#1B1F3B'
      },
      oauth_config: {
        redirect_urls: redirectUri ? [redirectUri] : [],
        scopes: { user: USER_SCOPES }
      },
      token_management_enabled: true,
      settings: {
        event_subscriptions: { user_events: ['message', 'channel', 'im', 'mpim'] },
        org_deploy_enabled: false,
        socket_mode_enabled: false,
        is_hosted: false,
        interactivity: { enabled: false }
      }
    },
    null,
    2
  )
}

function maskToken(token: string): string {
  if (token.length < 14) return '•'.repeat(token.length)
  return `${token.slice(0, 9)}…${token.slice(-4)}`
}

interface TokenResult {
  valid: boolean
  teamName?: string
  teamId?: string
  userName?: string
  scopes?: string[]
  error?: string
}

function safeVaultKey(teamName: string): string {
  return (
    'DASH_TOKEN_' +
    teamName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  )
}

/** Vault key naming scheme: DASH_TOKEN_<PROJECT> — fixed, not user-invented. */
function vaultKeyForProject(projectName: string): string {
  const key = safeVaultKey(projectName)
  return key === 'DASH_TOKEN_' ? '' : key
}

const STEPS = [
  'Create Slack app',
  'Install & get token',
  'Choose channels',
  'Confirm card',
  'Finish'
] as const

/** Channel list for a saved vault connector (module scope = stable for effects). */
async function fetchChannels(key: string): Promise<Array<{ id: string; name: string }>> {
  const found = await window.api.dashboard.listChannels({
    tokenSource: 'manual',
    manualTokenKey: key
  })
  return found.map((c) => ({ id: c.id, name: c.name }))
}

export default function DashboardWizard(): React.ReactElement {
  const snapshot = useDashboardStore((s) => s.snapshot)
  const wizardOpenFor = useDashboardStore((s) => s.wizardOpenFor)
  const closeWizard = useDashboardStore((s) => s.closeWizard)
  const addManualToken = useDashboardStore((s) => s.addManualToken)
  const upsertProject = useDashboardStore((s) => s.upsertProject)
  const syncNow = useDashboardStore((s) => s.syncNow)

  const target = useMemo(() => {
    if (!wizardOpenFor?.projectId || !snapshot) return null
    return snapshot.projects.find((p) => p.project.id === wizardOpenFor.projectId) ?? null
  }, [wizardOpenFor, snapshot])

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(target ? 3 : 1)

  // app-config for manifest (fetched once)
  const [appConfig, setAppConfig] = useState<{ clientId: string; redirectUri: string } | null>(null)
  const manifest = useMemo(
    () => buildManifest(appConfig?.clientId ?? '', appConfig?.redirectUri ?? ''),
    [appConfig]
  )
  const [copied, setCopied] = useState<'manifest' | 'none'>('none')
  useEffect(() => {
    let alive = true
    void window.api.dashboard.getAppConfig().then((c) => {
      if (alive) setAppConfig(c)
    })
    return () => {
      alive = false
    }
  }, [])

  // paste/connect state
  const [tokenValue, setTokenValue] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [result, setResult] = useState<TokenResult | null>(() => {
    const key = target?.project.manualTokenKey
    const entry = key && snapshot ? snapshot.manualTokens.find((t) => t.key === key) : undefined
    return entry ? { valid: entry.validated, teamName: entry.teamName, teamId: entry.teamId } : null
  })
  const [savedKey, setSavedKey] = useState(target?.project.manualTokenKey ?? '')
  const [savedTokenMask, setSavedTokenMask] = useState(
    target?.project.manualTokenKey && target?.project.tokenSource === 'manual'
      ? maskToken(target?.project.manualTokenKey)
      : ''
  )
  const [replaceMode, setReplaceMode] = useState(false)

  // channels
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([])
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [channelError, setChannelError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(target?.project.monitors.map((m) => m.channelId) ?? [])
  )

  // confirm
  const [projectName, setProjectName] = useState(target?.project.name ?? '')
  const [clientName, setClientName] = useState(target?.project.clientName ?? '')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // derived — fixed naming scheme: DASH_TOKEN_<PROJECT> (never user-invented)
  const vaultKey = useMemo(() => vaultKeyForProject(projectName.trim()), [projectName])

  const missingScopes = useMemo(() => {
    if (!result?.scopes) return []
    const granted = new Set(result.scopes)
    return USER_SCOPES.filter((s) => OPTIONAL_SCOPES.has(s) && !granted.has(s))
  }, [result])

  async function loadChannelList(): Promise<void> {
    setLoadingChannels(true)
    setChannelError(null)
    try {
      if (!savedKey) {
        setChannels([])
        return
      }
      setChannels(await fetchChannels(savedKey))
    } catch (err) {
      setChannels([])
      setChannelError(err instanceof Error ? err.message : 'channel fetch failed')
    } finally {
      setLoadingChannels(false)
    }
  }

  // Auto-load the channel list when the channels step opens (async only —
  // no synchronous state writes inside the effect body).
  useEffect(() => {
    if (step !== 3 || !savedKey || channels.length > 0) return
    let alive = true
    void (async () => {
      try {
        const found = await fetchChannels(savedKey)
        if (!alive) return
        setChannels(found)
        setChannelError(null)
      } catch (err) {
        if (!alive) return
        setChannels([])
        setChannelError(err instanceof Error ? err.message : 'channel fetch failed')
      }
    })()
    return () => {
      alive = false
    }
  }, [step, savedKey, channels.length])

  async function connectToken(): Promise<void> {
    if (!vaultKey.trim() || !tokenValue.trim()) {
      setConnectError('Project name and token are both required.')
      return
    }
    setConnecting(true)
    setConnectError(null)
    try {
      const r = await addManualToken(vaultKey.trim(), tokenValue.trim())
      if (!r.valid) {
        setConnectError(r.error ?? 'Slack rejected this token.')
        return
      }
      setResult({
        valid: true,
        teamName: r.teamName,
        teamId: r.teamId,
        userName: r.userName,
        scopes: r.scopes
      })
      setSavedKey(vaultKey.trim())
      setSavedTokenMask(maskToken(tokenValue.trim()))
      setTokenValue('')
      if (!clientName) setClientName(r.userName ?? r.teamName ?? '')
      setStep(3)
    } finally {
      setConnecting(false)
    }
  }

  function pickChannels(): void {
    if (selected.size === 0) return
    if (!projectName.trim() && result?.teamName) setProjectName(result.teamName)
    setStep(4)
  }

  async function createCard(): Promise<void> {
    if (!projectName.trim() || selected.size === 0) return
    setCreating(true)
    setCreateError(null)
    try {
      const id =
        target?.project.id ??
        `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const monitors = channels
        .filter((c) => selected.has(c.id))
        .map((c) => ({ channelId: c.id, channelName: c.name }))
      await upsertProject({
        ...(target ? target.project : undefined),
        id,
        name: projectName.trim(),
        clientName: clientName.trim() || projectName.trim(),
        profileId: `manual:${savedKey}`,
        teamId: result?.teamId ?? 'manual',
        teamName: result?.teamName,
        appId: 'slack',
        tokenSource: 'manual',
        manualTokenKey: savedKey,
        monitors: monitors.length
          ? monitors
          : (target?.project.monitors ?? []).map((m) => ({
              channelId: m.channelId,
              channelName: m.channelName
            }))
      })
      setStep(5)
      void syncNow(id)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'project save failed')
    } finally {
      setCreating(false)
    }
  }

  async function copyManifest(): Promise<void> {
    try {
      await navigator.clipboard.writeText(manifest)
      setCopied('manifest')
      setTimeout(() => setCopied('none'), 1800)
    } catch {
      setCopied('none')
    }
  }

  return (
    <div className="settings-backdrop wizard-backdash" onClick={closeWizard}>
      <section
        className="wizard-panel"
        role="dialog"
        aria-label="Set up new project"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="wizard-header">
          <div className="wizard-steps" aria-label="wizard progress">
            {STEPS.map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3 | 4 | 5
              return (
                <span
                  key={label}
                  className={`wizard-dot${step === n ? ' is-active' : ''}${step > n ? ' is-done' : ''}`}
                >
                  {step > n ? '✓' : n}
                </span>
              )
            })}
            <span className="wizard-step-label">{STEPS[step - 1]}</span>
          </div>
          <button type="button" className="dash-icon-btn" onClick={closeWizard} title="Close">
            ✕
          </button>
        </header>

        {/* ===== STEP 1 — guided connect ===== */}
        {step === 1 ? (
          <div className="wizard-body">
            <h3>Connect a workspace</h3>
            <ol className="wizard-guide">
              <li>
                <p>
                  <b>1. Create the Slack app</b> (one-time, ~1 min) — it is read-only and you own
                  it. Open{' '}
                  <a href={APPS_HOME} target="_blank" rel="noreferrer">
                    api.slack.com/apps
                  </a>{' '}
                  and click <b>Create New App → From an app manifest</b>.
                </p>
              </li>
              <li>
                <p>
                  <b>2. Paste this manifest JSON</b> in the manifest box (it already carries the 12
                  read scopes and a correct redirect URL):
                </p>
                <pre className="wizard-code">{manifest}</pre>
                <button type="button" className="dash-subtle" onClick={() => void copyManifest()}>
                  {copied === 'manifest' ? '✓ Copied' : '⧉ Copy JSON'}
                </button>
              </li>
              <li>
                <p>
                  <b>3. Install it to the workspace</b> — while in your app page open{' '}
                  <b>Settings → Install App → Install to workspace</b> and press <b>Allow</b>.
                </p>
              </li>
              <li>
                <p>
                  <b>4. Find &amp; copy the token</b> — still on the app page, open{' '}
                  <b>Settings → OAuth &amp; Permissions</b>; under <b>User OAuth Tokens</b> you will
                  see <code>xoxp-…</code>. Click copy (if no token exists yet, press{' '}
                  <b>Install to workspace</b> first).
                </p>
              </li>
            </ol>
            <p className="settings-hint">
              Tip: repeat step 3 once <b>per workspace</b> you want to read — each install gives a
              token that only reads that workspace.
            </p>
            <div className="settings-actions">
              <button type="button" className="dash-primary" onClick={() => setStep(2)}>
                I have the token →
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="wizard-body">
            <h3>Paste the token</h3>
            {savedTokenMask && !replaceMode ? (
              <>
                <p className="wizard-saved-token">
                  saved connector: <code>{savedKey}</code> · <code>{savedTokenMask}</code>
                </p>
                <div className="settings-actions">
                  <button type="button" className="dash-subtle" onClick={() => setStep(3)}>
                    Continue with it →
                  </button>
                </div>
                <button
                  type="button"
                  className="wizard-linklike"
                  onClick={() => setReplaceMode(true)}
                >
                  Replace this token…
                </button>
              </>
            ) : (
              <>
                <label className="settings-row">
                  <p className="settings-hint">
                    Project name — the key becomes <code>{vaultKey || 'DASH_TOKEN_<PROJECT>'}</code>{' '}
                    automatically
                  </p>
                  <input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Acme Website Redesign"
                    autoFocus
                  />
                </label>
                <label className="settings-row">
                  <p className="settings-hint">
                    The <code>xoxp-…</code> you copied from OAuth &amp; Permissions
                  </p>
                  <input
                    type="password"
                    value={tokenValue}
                    onChange={(e) => setTokenValue(e.target.value)}
                    placeholder="xoxp-…"
                  />
                </label>
                {connectError ? <p className="wizard-error">{connectError}</p> : null}
                {result?.valid && !savedTokenMask ? (
                  <p className="settings-hint">
                    ✅ verified: <b>{result.teamName}</b> as {result.userName ?? 'workspace user'}
                    {missingScopes.length > 0
                      ? ` · partial scopes (missing ${missingScopes.join(', ')})`
                      : ''}
                  </p>
                ) : null}
                <div className="settings-actions">
                  <button type="button" className="dash-subtle" onClick={() => setStep(1)}>
                    ← Setup guide
                  </button>
                  <button
                    type="button"
                    className="dash-primary"
                    disabled={connecting || !vaultKey}
                    onClick={() => void connectToken()}
                  >
                    {connecting ? 'Validating…' : 'Validate & Add'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* ===== STEP 2 — channels ===== */}
        {step === 3 ? (
          <div className="wizard-body">
            <h3>Choose channels</h3>
            <p className="wizard-sub">
              {loadingChannels
                ? 'Loading channels via token…'
                : `${channels.length} readable with ${savedKey} — tick what this card watches.`}
            </p>
            {channelError ? (
              <>
                <p className="wizard-error">{channelError}</p>
                <button
                  type="button"
                  className="dash-subtle"
                  onClick={() => void loadChannelList()}
                >
                  ⟳ Retry channel fetch
                </button>
              </>
            ) : null}
            <div className="wizard-channels">
              {channels.map((c) => (
                <label key={c.id} className="dash-channel-option">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(c.id)
                        else next.delete(c.id)
                        return next
                      })
                    }
                  />
                  <span>#{c.name}</span>
                </label>
              ))}
              {!loadingChannels && channels.length === 0
                ? 'No channels visible for this connector yet.'
                : null}
            </div>
            {selected.size > 0 ? <p className="settings-hint">{selected.size} selected</p> : null}
            <div className="settings-actions">
              <button type="button" className="dash-subtle" onClick={() => setStep(2)}>
                ← Back
              </button>
              <button
                type="button"
                className="dash-primary"
                disabled={selected.size === 0}
                onClick={pickChannels}
              >
                Continue →
              </button>
            </div>
          </div>
        ) : null}

        {/* ===== STEP 3 — confirm ===== */}
        {step === 4 ? (
          <div className="wizard-body">
            <h3>Confirm card</h3>
            <p className="wizard-sub">Names are pre-filled from the workspace — edit freely.</p>
            <label className="settings-row">
              <p className="settings-hint">Project (card title)</p>
              <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            </label>
            <label className="settings-row">
              <p className="settings-hint">Client</p>
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </label>
            <p className="settings-hint">
              {selected.size} channel{selected.size === 1 ? '' : 's'} ·{' '}
              {Array.from(selected)
                .map((chId) => channels.find((c) => c.id === chId)?.name ?? chId)
                .join(', ')}
            </p>
            {createError ? <p className="wizard-error">{createError}</p> : null}
            <p className="settings-hint">
              Adding triggers an automatic first sync — the card opens with fresh data.
            </p>
            <div className="settings-actions">
              <button type="button" className="dash-subtle" onClick={() => setStep(3)}>
                ← Back
              </button>
              <button
                type="button"
                className="dash-primary"
                disabled={creating || !projectName.trim()}
                onClick={() => void createCard()}
              >
                {creating ? 'Syncing…' : 'Add project'}
              </button>
            </div>
          </div>
        ) : null}

        {/* ===== STEP 5 — finish ===== */}
        {step === 5 ? (
          <div className="wizard-body wizard-finish">
            <p className="wizard-finish-check">✅</p>
            <h3>{projectName.trim() ? projectName.trim() : 'Project'} added to the dashboard</h3>
            <p className="wizard-sub">
              The card is live and its <b>first sync is running</b> — fresh messages, % completion,
              client mood and dates will fill in within seconds. After that it refreshes
              automatically every {snapshot?.syncIntervalSeconds ?? 300}s (new messages only).
            </p>
            <div className="settings-actions">
              <button type="button" className="dash-primary" onClick={closeWizard}>
                Done — show me the dashboard
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
