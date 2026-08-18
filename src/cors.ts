import type { CorsProxyMode } from './types'

export interface ProxyOption {
  value: CorsProxyMode
  label: string
  hint?: string
}

export const PROXY_OPTIONS: ProxyOption[] = [
  { value: 'none', label: 'Nenhum (direto)' },
  { value: 'corsproxy', label: 'corsproxy.io' },
  { value: 'cors-euorg', label: 'cors.eu.org' },
]

export function withProxy(url: string, mode: CorsProxyMode): string {
  if (mode === 'corsproxy') {
    return `https://corsproxy.io/?url=${encodeURIComponent(url)}`
  }
  if (mode === 'cors-euorg') {
    return `https://cors.eu.org/${url}`
  }
  return url
}

export async function fetchWithProxy(
  url: string,
  mode: CorsProxyMode,
  timeoutMs = 15000,
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(withProxy(url, mode), { signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}