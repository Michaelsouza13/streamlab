import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Loader2, ListVideo, Plus, Search, Sparkles, X } from 'lucide-react'
import type { Category, MediaLink, Settings, TmdbMetadata } from '../types'
import { fetchRemoteList, isPlaylistUrl, parseM3u } from '../m3u'
import type { ParsedEntry } from '../m3u'
import { TmdbSearchModal } from './TmdbSearchModal'

interface AddModalProps {
  categories: Category[]
  settings: Settings
  existingUrls: Set<string>
  editing?: MediaLink | null
  onAdd: (link: Omit<MediaLink, 'id' | 'createdAt' | 'status'>) => void
  onAddList: (entries: ParsedEntry[], fallbackCategoryId: string | null) => void
  onUpdate: (id: string, fields: Partial<MediaLink>) => void
  onClose: () => void
}

export function AddModal({
  categories,
  settings,
  existingUrls,
  editing,
  onAdd,
  onAddList,
  onUpdate,
  onClose,
}: AddModalProps) {
  const [name, setName] = useState(editing?.name ?? '')
  const [url, setUrl] = useState(editing?.url ?? '')
  const [categoryId, setCategoryId] = useState<string>(editing?.categoryId ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [listMode, setListMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [listPreview, setListPreview] = useState<ParsedEntry[] | null>(null)
  const [tmdbOpen, setTmdbOpen] = useState(false)
  const [metadata, setMetadata] = useState<TmdbMetadata | null>(editing?.metadata ?? null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleUrlChange = (value: string) => {
    setUrl(value)
    if (value && isPlaylistUrl(value)) {
      setListMode(true)
      setListPreview(null)
    }
  }

  const handleDetectList = async () => {
    if (!url.trim()) return
    setBusy(true)
    setError('')
    try {
      const text = await fetchRemoteList(url.trim(), settings.corsProxy)
      const entries = parseM3u(text)
      if (!entries.length) {
        setError('A URL não retornou uma lista M3U válida.')
        setListMode(false)
      } else {
        setListMode(true)
        setListPreview(entries)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao baixar a lista.')
      setListMode(false)
    } finally {
      setBusy(false)
    }
  }

  const handleUrlBlur = () => {
    if (url && !name.trim() && !isPlaylistUrl(url)) {
      try {
        const guess = new URL(url).pathname.split('/').filter(Boolean).pop()?.replace(/\.(m3u8|m3u|mp4)$/i, '')
        if (guess) setName(decodeURIComponent(guess))
      } catch {
        /* URL inválida — ignora autocompletar */
      }
    }
  }

  const handleSubmit = () => {
    setError('')

    if (listMode) {
      if (!url.trim()) {
        setError('Informe a URL da lista .m3u/.m3u8 para importar.')
        return
      }
      if (listPreview) {
        onAddList(listPreview, categoryId || null)
        onClose()
        return
      }
      void handleDetectList()
      return
    }

    const trimmedUrl = url.trim()
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setError('A URL precisa começar com http:// ou https://')
      return
    }
    if (!name.trim()) {
      setError('Dê um nome para a mídia (ou use “Buscar no TMDB”).')
      return
    }
    if (existingUrls.has(trimmedUrl) && trimmedUrl !== editing?.url) {
      setError('Essa URL já existe na sua biblioteca.')
      return
    }

    if (editing) {
      onUpdate(editing.id, { name: name.trim(), url: trimmedUrl, categoryId: categoryId || null, notes: notes.trim() || undefined })
    } else {
      onAdd({
        name: name.trim(),
        url: trimmedUrl,
        categoryId: categoryId || null,
        notes: notes.trim() || undefined,
        metadata: metadata ?? null,
      })
    }
    onClose()
  }

  const field =
    'w-full rounded-xl border border-hairline bg-panel2 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-accent/60 focus:ring-2 focus:ring-accent/20'

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg rounded-2xl border border-hairline bg-panel p-5 shadow-2xl shadow-black/60"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-white">
            {editing ? 'Editar mídia' : listMode ? 'Importar lista' : 'Nova mídia'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">URL do stream ou lista</label>
            <div className="flex gap-2">
              <input
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://exemplo.com/stream.m3u8 ou .m3u"
                className={field}
                autoFocus
              />
              <button
                onClick={handleDetectList}
                disabled={busy}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-hairline bg-panel2 px-3 text-xs font-medium text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
                title="Baixar e ler a lista desta URL"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <ListVideo size={14} />}
                Ler lista
              </button>
            </div>
            {listMode && !listPreview && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-300">
                <AlertTriangle size={13} /> Lista detectada — ao salvar, os canais dela serão importados.
              </p>
            )}
            {listPreview && (
              <p className="mt-1.5 text-xs text-emerald-400">
                {listPreview.length} canais encontrados. Clique em “Importar” para adicioná-los.
              </p>
            )}
          </div>

          {!listMode && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Nome</label>
                <div className="flex gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome da mídia"
                    className={field}
                  />
                  <button
                    onClick={() => setTmdbOpen(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-pink-500 px-3 text-xs font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110"
                    title="Buscar informações no TMDB"
                  >
                    <Search size={14} /> TMDB
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Categoria</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={field}
                >
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Observações</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional"
                  className={field}
                />
              </div>

              {metadata && (
                <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 p-2.5">
                  {metadata.posterPath ? (
                    <img src={metadata.posterPath} alt="" className="size-12 rounded-lg object-cover" />
                  ) : (
                    <span className="flex size-12 items-center justify-center rounded-lg bg-accent/20">
                      <Sparkles size={16} className="text-accent" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{metadata.title}</p>
                    <p className="truncate text-xs text-zinc-400">
                      {metadata.year ?? '—'} · {metadata.mediaType === 'movie' ? 'Filme' : 'Série'} ·{' '}
                      {metadata.rating ? `★ ${metadata.rating}` : 'sem nota'}
                    </p>
                  </div>
                  <button
                    onClick={() => setMetadata(null)}
                    className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                    aria-label="Remover metadados"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            {listMode ? 'Importar' : editing ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </motion.div>

      {tmdbOpen && (
        <TmdbSearchModal
          initialQuery={name}
          apiKey={settings.tmdbApiKey}
          language={settings.tmdbLanguage}
          onPick={(m) => {
            setMetadata(m)
            if (!name.trim()) setName(m.title)
            setTmdbOpen(false)
          }}
          onClose={() => setTmdbOpen(false)}
        />
      )}
    </motion.div>
  )
}
