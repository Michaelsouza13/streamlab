export type LinkStatus = 'ok' | 'fail' | 'unknown'

export interface TmdbMetadata {
  tmdbId: number
  title: string
  mediaType: 'movie' | 'tv'
  year: number | null
  overview: string
  posterPath: string | null
  backdropPath: string | null
  rating: number | null
}

export interface MediaLink {
  id: string
  name: string
  url: string
  categoryId: string | null
  logo?: string | null
  notes?: string
  metadata?: TmdbMetadata | null
  status: LinkStatus
  lastTestedAt?: string | null
  createdAt: number
}

export interface Category {
  id: string
  name: string
  color: string
}

export type CorsProxyMode = 'none' | 'corsproxy' | 'cors-euorg'

export interface Settings {
  tmdbApiKey: string
  corsProxy: CorsProxyMode
  tmdbLanguage: string
}

export interface AppData {
  version: number
  categories: Category[]
  links: MediaLink[]
  settings: Settings
}
