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

export interface Settings {
  tmdbApiKey: string
  tmdbLanguage: string
  workerUrl: string
}

export interface AppData {
  version: number
  categories: Category[]
  links: MediaLink[]
  settings: Settings
}
