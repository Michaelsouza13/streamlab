export function withWorker(url: string, workerUrl: string): string {
  const base = workerUrl.replace(/\/+$/, '')
  return `${base}/?u=${encodeURIComponent(url)}`
}

export async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}