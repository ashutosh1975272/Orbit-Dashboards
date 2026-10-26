type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const TOKEN_PATTERNS = [
  /xox[a-zA-Z]-[A-Za-z0-9-]+/g,
  /nvapi-[A-Za-z0-9-]+/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi
]

function redactString(value: string): string {
  let redacted = value
  for (const pattern of TOKEN_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]')
  }
  return redacted
}

function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactString(value)
  }

  if (Array.isArray(value)) {
    return value.map(redact)
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (/token|secret|password|authorization|key/i.test(key)) {
        out[key] = '[REDACTED]'
      } else {
        out[key] = redact(nested)
      }
    }
    return out
  }

  return value
}

function write(level: LogLevel, message: string, meta?: unknown): void {
  const entry = {
    level,
    message: redactString(message),
    ...(meta !== undefined ? { meta: redact(meta) } : {}),
    ts: new Date().toISOString()
  }
  const line = JSON.stringify(entry)
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export const log = {
  debug: (message: string, meta?: unknown): void => write('debug', message, meta),
  info: (message: string, meta?: unknown): void => write('info', message, meta),
  warn: (message: string, meta?: unknown): void => write('warn', message, meta),
  error: (message: string, meta?: unknown): void => write('error', message, meta)
}
