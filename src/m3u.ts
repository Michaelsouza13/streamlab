import type { Category, MediaLink } from './types'
import { uid } from './storage'
import { fetchWithProxy } from './cors'
import type { CorsProxyMode } from './types'

export interface ParsedEntry {
  name: string
  url: string
  logo?: string
  group?: string
}

function parseAttributes(line: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const match of line.matchAll(/([\w-]+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2]
  }
  return attrs
}

export function parseM3u(text: string): ParsedEntry[] {
  const entries: ParsedEntry[] = []
  let current: ParsedEntry | null = null

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#EXTM3U')) continue
    if (line.startsWith('#EXTINF')) {
      const attrs = parseAttributes(line)
      const name = line.slice(line.lastIndexOf(',') + 1).trim() || 'Sem nome'
      current = { name, url: '', logo: attrs['tvg-logo'] || undefined, group: attrs['group-title'] || undefined }
      continue
    }
    if (line.startsWith('#')) continue
    if (current) {
      current.url = line
      entries.push(current)
      current = null
    }
  }
  return entries
}

export function entriesToLinks(
  entries: ParsedEntry[],
  categories: Category[],
  fallbackCategoryId: string | null = null,
): MediaLink[] {
  const now = Date.now()
  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))
  const links: MediaLink[] = []
  const seen = new Set<string>()

  for (const e of entries) {
    const urlKey = e.url.trim()
    if (!urlKey || seen.has(urlKey)) continue
    seen.add(urlKey)
    links.push({
      id: uid(),
      name: e.name,
      url: urlKey,
      categoryId: e.group ? (catByName.get(e.group.toLowerCase())?.id ?? fallbackCategoryId) : fallbackCategoryId,
      logo: e.logo ?? null,
      status: 'unknown',
      createdAt: now + links.length,
    })
  }
  return links
}

export function exportM3u(links: MediaLink[], categories: Category[]): string {
  const nameById = new Map(categories.map((c) => [c.id, c.name]))
  const lines = ['#EXTM3U']
  for (const l of links) {
    const attrs: string[] = []
    if (l.logo) attrs.push(`tvg-logo="${l.logo}"`)
    if (l.categoryId) {
      const catName = nameById.get(l.categoryId)
      if (catName) attrs.push(`group-title="${catName}"`)
    }
    const prefix = attrs.length ? `#EXTINF:-1 ${attrs.join(' ')}` : '#EXTINF:-1'
    lines.push(`${prefix},${l.name.replace(/,/g, '')}`)
    lines.push(l.url)
  }
  return lines.join('\n')
}

export async function fetchRemoteList(
  url: string,
  corsProxy: CorsProxyMode,
): Promise<string> {
  const res = await fetchWithProxy(url, corsProxy, 20000)
  if (!res.ok) throw new Error(`Falha ao baixar lista (HTTP ${res.status})`)
  return res.text()
}

export function isPlaylistUrl(url: string): boolean {
  return /\.m3u8?(\?|#|$)/i.test(url)
}
