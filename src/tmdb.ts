import type { TmdbMetadata } from './types'
import { clearTmdbCache, loadTmdbCache, saveTmdbCache } from './storage'

const BASE = 'https://api.themoviedb.org/3'
const cache = loadTmdbCache()

interface RawResult {
  id: number
  media_type: string
  title?: string
  name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  release_date?: string
  first_air_date?: string
}

function mapResult(r: RawResult): TmdbMetadata {
  const rawYear = (r.release_date ?? r.first_air_date ?? '').slice(0, 4)
  const year = rawYear ? Number(rawYear) : null
  return {
    tmdbId: r.id,
    title: r.title ?? r.name ?? 'Sem título',
    mediaType: r.media_type === 'tv' ? 'tv' : 'movie',
    year,
    overview: r.overview ?? '',
    posterPath: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null,
    backdropPath: r.backdrop_path ? `https://image.tmdb.org/t/p/w780${r.backdrop_path}` : null,
    rating: typeof r.vote_average === 'number' ? Math.round(r.vote_average * 10) / 10 : null,
  }
}

let lastCall = 0

export async function searchTmdb(
  query: string,
  apiKey: string,
  language: string,
): Promise<TmdbMetadata[]> {
  const q = query.trim()
  if (!q) return []
  const key = `${language}:${q.toLowerCase()}`

  const cached = cache[key]
  if (cached && cached.length) return cached as TmdbMetadata[]

  const wait = 350 - (Date.now() - lastCall)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()

  const url = `${BASE}/search/multi?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(q)}&language=${encodeURIComponent(language)}`
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 401) throw new Error('Chave da TMDB inválida. Verifique nas Configurações.')
    if (res.status === 429) throw new Error('Muitas requisições à TMDB. Tente novamente em instantes.')
    throw new Error(`Erro na TMDB (HTTP ${res.status})`)
  }
  const json = (await res.json()) as { results?: RawResult[] }
  const results = (json.results ?? [])
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 12)
    .map(mapResult)

  cache[key] = results
  saveTmdbCache(cache)
  return results
}

export function resetTmdbCache(): void {
  clearTmdbCache()
  Object.keys(cache).forEach((k) => delete cache[k])
}
