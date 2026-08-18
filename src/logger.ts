export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  ts: number
  level: LogLevel
  source: string
  msg: string
  data?: unknown
}

const MAX = 300
const KEY = 'streamlab:logs:v1'

let entries: LogEntry[] = []
try {
  const raw = localStorage.getItem(KEY)
  if (raw) entries = (JSON.parse(raw) as LogEntry[]).filter((e) => e && typeof e.msg === 'string')
} catch {
  /* ignora */
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function log(level: LogLevel, source: string, msg: string, data?: unknown): void {
  const entry: LogEntry = { id: uid(), ts: Date.now(), level, source, msg, data }
  entries.push(entry)
  if (entries.length > MAX) entries.splice(0, entries.length - MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    /* storage cheio — mantém só em memória */
  }
  const line = `[${new Date(entry.ts).toLocaleTimeString('pt-BR')}] [${source}] ${msg}`
  if (level === 'error') console.error(line, data ?? '')
  else if (level === 'warn') console.warn(line, data ?? '')
  else console.log(line, data ?? '')
}

export function getLogs(): LogEntry[] {
  return [...entries]
}

export function clearLogs(): void {
  entries = []
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignora */
  }
  log('info', 'logs', 'Registro de logs limpo')
}

function safeJson(v: unknown): string {
  try {
    const s = JSON.stringify(v)
    if (!s) return String(v)
    return s.length > 500 ? `${s.slice(0, 500)}…` : s
  } catch {
    return String(v)
  }
}

export function logsToText(): string {
  const head = [
    `StreamLab — Logs`,
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Total de entradas: ${entries.length}`,
    '─'.repeat(64),
  ]
  const lines = entries.map((e) => {
    const t = new Date(e.ts).toLocaleTimeString('pt-BR')
    const dataPart = e.data === undefined ? '' : `\n    dados: ${safeJson(e.data)}`
    return `[${t}] [${e.level.toUpperCase()}] [${e.source}] ${e.msg}${dataPart}`
  })
  return [...head, ...lines].join('\n')
}

export function downloadLogs(): void {
  const blob = new Blob([logsToText()], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `streamlab-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`
  a.click()
  URL.revokeObjectURL(url)
}