import type { AppData, Category, Settings } from './types'

const DATA_KEY = 'streamlab:data:v1'
const TMDB_CACHE_KEY = 'streamlab:tmdb:cache:v1'

export const CATEGORY_COLORS = [
  '#f472b6',
  '#818cf8',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#22d3ee',
  '#a78bfa',
  '#fb923c',
  '#4ade80',
  '#e879f9',
]

export const DEFAULT_SETTINGS: Settings = {
  tmdbApiKey: '',
  tmdbLanguage: 'pt-BR',
  workerUrl: '',
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'canais', name: 'Canais ao vivo', color: '#f472b6' },
  { id: 'filmes', name: 'Filmes', color: '#818cf8' },
  { id: 'series', name: 'Séries', color: '#34d399' },
  { id: 'testes', name: 'Testes', color: '#fbbf24' },
]

export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  )
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return defaultData()
    const parsed = JSON.parse(raw) as Partial<AppData>
    return {
      version: 1,
      categories: parsed.categories?.length ? parsed.categories : DEFAULT_CATEGORIES,
      links: parsed.links ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    }
  } catch {
    return defaultData()
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(DATA_KEY, JSON.stringify(data))
}

function defaultData(): AppData {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES,
    links: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}

type TmdbCache = Record<string, unknown[]>

export function loadTmdbCache(): TmdbCache {
  try {
    const raw = localStorage.getItem(TMDB_CACHE_KEY)
    return raw ? (JSON.parse(raw) as TmdbCache) : {}
  } catch {
    return {}
  }
}

export function saveTmdbCache(cache: TmdbCache): void {
  try {
    localStorage.setItem(TMDB_CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* storage cheio — ignora */
  }
}

export function clearTmdbCache(): void {
  localStorage.removeItem(TMDB_CACHE_KEY)
}
