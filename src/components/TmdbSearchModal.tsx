import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Film, Loader2, Search, Star, Tv, X } from 'lucide-react'
import type { TmdbMetadata } from '../types'
import { searchTmdb } from '../tmdb'

interface TmdbSearchModalProps {
  initialQuery: string
  apiKey: string
  language: string
  onPick: (metadata: TmdbMetadata) => void
  onClose: () => void
}

export function TmdbSearchModal({ initialQuery, apiKey, language, onPick, onClose }: TmdbSearchModalProps) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<TmdbMetadata[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const run = async (q: string) => {
    if (!q.trim()) return
    if (!apiKey.trim()) {
      setError('Adicione sua chave da TMDB nas Configurações primeiro.')
      return
    }
    setBusy(true)
    setError('')
    setSearched(true)
    try {
      const r = await searchTmdb(q, apiKey.trim(), language)
      setResults(r)
      if (!r.length) setError('Nenhum resultado encontrado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar na TMDB.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-2xl rounded-2xl border border-hairline bg-panel p-5 shadow-2xl shadow-black/60"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-white">Buscar no TMDB</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void run(query)
            }}
            placeholder="Nome do filme ou série…"
            className="w-full rounded-xl border border-hairline bg-panel2 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            autoFocus
          />
          <button
            onClick={() => void run(query)}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-pink-500 px-4 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Buscar
          </button>
        </div>

        {error && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertTriangle size={13} /> {error}
          </p>
        )}

        <div className="mt-4 grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
          {results.map((m) => (
            <motion.button
              key={`${m.mediaType}-${m.tmdbId}`}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPick(m)}
              className="group overflow-hidden rounded-xl border border-hairline bg-panel2 text-left transition hover:border-accent/50"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-ink">
                {m.posterPath ? (
                  <img
                    src={m.posterPath}
                    alt={m.title}
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-gradient-to-br from-panel2 to-ink">
                    {m.mediaType === 'movie' ? <Film size={28} className="text-zinc-600" /> : <Tv size={28} className="text-zinc-600" />}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6">
                  <p className="line-clamp-2 text-xs font-semibold leading-snug text-white">{m.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
                    {m.mediaType === 'movie' ? 'Filme' : 'Série'}
                    {m.year ? ` · ${m.year}` : ''}
                    {m.rating ? (
                      <span className="flex items-center gap-0.5 text-amber-400">
                        <Star size={10} fill="currentColor" /> {m.rating}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
            </motion.button>
          ))}
          {searched && !busy && results.length === 0 && !error && (
            <p className="col-span-full py-8 text-center text-sm text-zinc-500">Nada encontrado. Tente outro termo.</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
