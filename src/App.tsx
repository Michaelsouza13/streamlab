import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  Check,
  CheckCircle2,
  CheckSquare,
  Clapperboard,
  Download,
  ExternalLink,
  FileUp,
  Loader2,
  Pencil,
  Play,
  Plus,
  Search,
  Settings as SettingsIcon,
  Square,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import type { AppData, LinkStatus, MediaLink, Settings } from './types'
import { CATEGORY_COLORS, loadData, saveData, uid } from './storage'
import { entriesToLinks, exportM3u, parseM3u } from './m3u'
import type { ParsedEntry } from './m3u'
import { resetTmdbCache } from './tmdb'
import { testLinkDetailed } from './linkTest'
import { log } from './logger'
import { Sidebar } from './components/Sidebar'
import { AddModal } from './components/AddModal'
import { SettingsModal } from './components/SettingsModal'
import { TmdbSearchModal } from './components/TmdbSearchModal'
import { LogsModal } from './components/LogsModal'
import { PlayerModal } from './player'

interface Toast {
  id: string
  msg: string
  kind: 'ok' | 'err'
  action?: { label: string; onClick: () => void }
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [selected, setSelected] = useState('all')
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<MediaLink | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [playing, setPlaying] = useState<MediaLink | null>(null)
  const [quickTmdb, setQuickTmdb] = useState<MediaLink | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [logsOpen, setLogsOpen] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const bootRef = useRef(false)

  useEffect(() => {
    saveData(data)
  }, [data])

  useEffect(() => {
    if (selectionMode) {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setSelectionMode(false)
          setSelectedIds(new Set())
        }
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }
  }, [selectionMode])

  const toast = useCallback((msg: string, kind: Toast['kind'] = 'ok', action?: Toast['action']) => {
    const id = uid()
    setToasts((t) => [...t, { id, msg, kind, action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  // Primeiro acesso: importa a lista padrão embutida no build
  useEffect(() => {
    if (bootRef.current || data.links.length > 0) return
    bootRef.current = true
    if (localStorage.getItem('streamlab:booted:v1')) return
    localStorage.setItem('streamlab:booted:v1', '1')
    log('info', 'boot', 'Primeiro acesso — importando lista padrão')
    const run = async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}default-playlist.m3u8`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const entries = parseM3u(await res.text())
        if (!entries.length) throw new Error('lista vazia')
        setData((d) => {
          const existing = new Set(d.links.map((l) => l.url))
          const canaisId = d.categories.find((c) => c.name === 'Canais ao vivo')?.id ?? null
          const fresh = entriesToLinks(entries, d.categories, canaisId).filter((l) => !existing.has(l.url))
          return { ...d, links: [...d.links, ...fresh] }
        })
        log('info', 'boot', `Lista padrão importada: ${entries.length} canais`)
        toast(`Lista padrão importada (${entries.length} canais)`)
      } catch (err) {
        log('error', 'boot', 'Falha ao importar lista padrão', {
          msg: err instanceof Error ? err.message : String(err),
        })
      }
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }))
  }, [])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const l of data.links) c[l.categoryId ?? 'none'] = (c[l.categoryId ?? 'none'] ?? 0) + 1
    return c
  }, [data.links])

  const visibleLinks = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.links
      .filter((l) => (selected === 'all' ? true : selected === 'none' ? !l.categoryId : l.categoryId === selected))
      .filter((l) => !q || l.name.toLowerCase().includes(q) || l.url.toLowerCase().includes(q))
      .sort((a, b) => a.createdAt - b.createdAt)
  }, [data.links, selected, query])

  const existingUrls = useMemo(() => new Set(data.links.map((l) => l.url)), [data.links])

  // ── CRUD ────────────────────────────────────────────────
  const addLink = (link: Omit<MediaLink, 'id' | 'createdAt' | 'status'>) => {
    setData((d) => ({
      ...d,
      links: [...d.links, { ...link, id: uid(), status: 'unknown', createdAt: Date.now() }],
    }))
    log('info', 'data', `Mídia adicionada: ${link.name}`)
    toast('Mídia adicionada')
  }

  const addList = (entries: ParsedEntry[], fallbackCategoryId: string | null) => {
    setData((d) => {
      const existing = new Set(d.links.map((l) => l.url))
      const fresh = entriesToLinks(entries, d.categories, fallbackCategoryId).filter((l) => !existing.has(l.url))
      return { ...d, links: [...d.links, ...fresh] }
    })
    log('info', 'data', `Lista importada: ${entries.length} canais (categoria padrão: ${fallbackCategoryId ?? 'nenhuma'})`)
    toast(`Lista importada (${entries.length} canais)`)
  }

  const updateLink = (id: string, fields: Partial<MediaLink>) => {
    setData((d) => ({
      ...d,
      links: d.links.map((l) => (l.id === id ? { ...l, ...fields } : l)),
    }))
    log('info', 'data', `Mídia atualizada: ${fields.metadata ? `metadados → ${fields.metadata.title}` : JSON.stringify(Object.keys(fields))}`)
    toast('Alterações salvas')
  }

  const deleteLink = (id: string) => {
    setData((d) => ({ ...d, links: d.links.filter((l) => l.id !== id) }))
    log('info', 'data', 'Mídia removida', { id })
    toast('Mídia removida')
  }

  const setLinkStatus = (id: string, status: LinkStatus) => {
    setData((d) => ({
      ...d,
      links: d.links.map((l) => (l.id === id ? { ...l, status, lastTestedAt: new Date().toISOString() } : l)),
    }))
  }

  // ── Categorias ──────────────────────────────────────────
  const addCategory = (name: string) => {
    const color = CATEGORY_COLORS[data.categories.length % CATEGORY_COLORS.length]
    setData((d) => ({ ...d, categories: [...d.categories, { id: uid(), name, color }] }))
    toast(`Categoria "${name}" criada`)
  }

  const renameCategory = (id: string, name: string) => {
    setData((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, name } : c)) }))
  }

  const deleteCategory = (id: string) => {
    setData((d) => ({
      ...d,
      categories: d.categories.filter((c) => c.id !== id),
      links: d.links.map((l) => (l.categoryId === id ? { ...l, categoryId: null } : l)),
    }))
    if (selected === id) setSelected('all')
  }

  // ── Seleção múltipla ────────────────────────────────────
  const allVisibleSelected = useMemo(
    () => visibleLinks.length > 0 && visibleLinks.every((l) => selectedIds.has(l.id)),
    [visibleLinks, selectedIds],
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleLinks.map((l) => l.id)))
  }

  const deleteSelected = () => {
    const n = selectedIds.size
    if (n === 0) return
    if (!window.confirm(`Remover ${n} mídia(s)?`)) return
    setData((d) => ({ ...d, links: d.links.filter((l) => !selectedIds.has(l.id)) }))
    log('info', 'data', `Remoção em lote: ${n} mídia(s)`)
    toast(`${n} mídia(s) removida(s)`)
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  // ── Teste de link ───────────────────────────────────────
  const testLink = useCallback(
    async (link: MediaLink) => {
      if (testingId) return
      setTestingId(link.id)
      const result = await testLinkDetailed(link.url, data.settings.corsProxy)
      setLinkStatus(link.id, result.ok ? 'ok' : 'fail')
      if (result.ok) {
        toast(`${link.name}: OK (${result.status})${result.bodyType === 'm3u8' ? ' · HLS válido' : ''}`)
      } else {
        const reason =
          result.errorKind === 'http'
            ? `HTTP ${result.status}`
            : result.errorKind === 'timeout'
              ? 'timeout (15s sem resposta)'
              : 'bloqueio CORS/rede'
        toast(`"${link.name}" falhou: ${reason}${result.preview ? ` — ${result.preview.slice(0, 40)}` : ''}`, 'err', {
          label: 'Ver logs',
          onClick: () => setLogsOpen(true),
        })
      }
      setTestingId(null)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [testingId, data.settings.corsProxy],
  )

  // ── Importar / Exportar ─────────────────────────────────
  const handleImportFile = async (file: File) => {
    const text = await file.text()
    if (file.name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(text) as Partial<AppData>
        if (!Array.isArray(parsed.links) || !Array.isArray(parsed.categories)) throw new Error()
        setData((d) => {
          const existing = new Set(d.links.map((l) => l.url))
          const fresh = (parsed.links ?? []).filter((l) => !existing.has(l.url))
          const seenIds = new Set(d.categories.map((c) => c.id))
          const freshCats = (parsed.categories ?? []).filter((c) => !seenIds.has(c.id))
          return {
            ...d,
            categories: [...d.categories, ...freshCats],
            links: [...d.links, ...fresh],
            settings: { ...d.settings, ...(parsed.settings ?? {}) },
          }
        })
        log('info', 'data', 'Backup JSON importado', { file: file.name })
        toast('Backup importado com sucesso')
      } catch {
        log('error', 'data', 'Backup JSON inválido', { file: file.name })
        toast('Arquivo de backup inválido', 'err')
      }
      return
    }
    const entries = parseM3u(text)
    if (entries.length) {
      addList(entries, null)
    } else {
      log('error', 'data', 'Arquivo sem entradas M3U', { file: file.name })
      toast('Nenhuma entrada M3U encontrada no arquivo', 'err')
    }
  }

  const handleExportM3u = () => {
    if (!data.links.length) {
      toast('Nenhuma mídia para exportar', 'err')
      return
    }
    download('playlist.m3u8', exportM3u(data.links, data.categories), 'application/x-mpegURL')
    toast('Playlist .m3u8 exportada')
  }

  const handleExportJson = () => {
    download('streamlab-backup.json', JSON.stringify(data, null, 2), 'application/json')
    toast('Backup exportado')
  }

  // Restauração manual da lista padrão (merge sem duplicar)
  const restoreDefaultList = async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}default-playlist.m3u8`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const entries = parseM3u(await res.text())
      if (!entries.length) throw new Error('lista vazia')
      const existing = new Set(data.links.map((l) => l.url))
      const canaisId = data.categories.find((c) => c.name === 'Canais ao vivo')?.id ?? null
      const fresh = entriesToLinks(entries, data.categories, canaisId).filter((l) => !existing.has(l.url))
      if (fresh.length === 0) {
        toast('Lista padrão já está toda na biblioteca')
        return
      }
      setData((d) => ({ ...d, links: [...d.links, ...fresh] }))
      log('info', 'data', `Restauração da lista padrão: ${fresh.length} canais adicionados`)
      toast(`Lista padrão restaurada (${fresh.length} canais)`)
    } catch (err) {
      log('error', 'data', 'Restauração da lista padrão falhou', {
        msg: err instanceof Error ? err.message : String(err),
      })
      toast('Falha ao restaurar a lista padrão', 'err')
    }
  }

  // ── UI helpers ──────────────────────────────────────────
  const catName = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? 'Sem categoria'
  const catColor = (id: string | null) => data.categories.find((c) => c.id === id)?.color ?? '#52525b'

  return (
    <div className="flex h-full">
      <Sidebar
        categories={data.categories}
        counts={counts}
        selected={selected}
        onSelect={setSelected}
        onAddCategory={addCategory}
        onRenameCategory={renameCategory}
        onDeleteCategory={deleteCategory}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-hairline bg-panel/60 px-5 py-3.5 backdrop-blur">
          {selectionMode ? (
            <>
              <button
                onClick={() => {
                  setSelectionMode(false)
                  setSelectedIds(new Set())
                }}
                className="rounded-xl border border-hairline bg-panel2 p-2.5 text-zinc-300 transition hover:bg-white/10"
                title="Sair do modo de seleção"
              >
                <X size={16} />
              </button>
              <span className="font-display text-sm font-semibold text-white">{selectedIds.size} selecionado(s)</span>
              <button
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-panel2 px-3.5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
              >
                {allVisibleSelected ? (
                  <>
                    <Square size={14} /> Desmarcar visíveis
                  </>
                ) : (
                  <>
                    <CheckSquare size={14} /> Marcar visíveis
                  </>
                )}
              </button>
              <div className="flex-1" />
              <button
                onClick={deleteSelected}
                disabled={selectedIds.size === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={15} /> Remover {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </button>
            </>
          ) : (
            <>
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome ou URL…"
                  className="w-full max-w-sm rounded-xl border border-hairline bg-panel2 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
                />
              </div>

              <button
                onClick={() => setSelectionMode(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-panel2 px-3.5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
                title="Selecionar várias mídias para remover"
              >
                <CheckSquare size={15} /> <span className="hidden sm:inline">Selecionar</span>
              </button>
              <button
                onClick={() => importRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-panel2 px-3.5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
                title="Importar .m3u, .m3u8 ou backup .json"
              >
                <FileUp size={15} /> <span className="hidden sm:inline">Importar</span>
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".m3u,.m3u8,.json,audio/x-mpegurl,application/x-mpegURL"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleImportFile(f)
                  e.target.value = ''
                }}
              />
              <button
                onClick={handleExportM3u}
                className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-panel2 px-3.5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
                title="Exportar playlist .m3u8"
              >
                <Download size={15} /> <span className="hidden sm:inline">Exportar</span>
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="rounded-xl border border-hairline bg-panel2 p-2.5 text-zinc-300 transition hover:bg-white/10"
                title="Configurações"
              >
                <SettingsIcon size={16} />
              </button>
              <button
                onClick={() => {
                  setEditing(null)
                  setAddOpen(true)
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110"
              >
                <Plus size={16} /> <span className="hidden sm:inline">Adicionar</span>
              </button>
            </>
          )}
        </header>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex items-baseline gap-2">
            <h2 className="font-display text-lg font-bold text-white">
              {selected === 'all' ? 'Todas as mídias' : selected === 'none' ? 'Sem categoria' : catName(selected)}
            </h2>
            <span className="text-sm text-zinc-500">{visibleLinks.length} item(ns)</span>
          </div>

          {visibleLinks.length === 0 ? (
            <div className="flex h-3/4 flex-col items-center justify-center gap-4 text-center">
              <span className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-accent/20 to-pink-500/20">
                <Clapperboard size={34} className="text-accent-300" />
              </span>
              <div>
                <p className="font-display text-base font-semibold text-white">Nada por aqui ainda</p>
                <p className="mt-1 max-w-sm text-sm text-zinc-500">
                  Adicione um link m3u8, cole a URL de uma lista .m3u para importar os canais de uma vez, ou suba um
                  arquivo pelo botão Importar.
                </p>
              </div>
              <button
                onClick={() => {
                  setEditing(null)
                  setAddOpen(true)
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110"
              >
                <Plus size={16} /> Adicionar primeiro link
              </button>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              <AnimatePresence mode="popLayout">
                {visibleLinks.map((link) => (
                  <MediaCard
                    key={link.id}
                    link={link}
                    catColor={catColor(link.categoryId)}
                    catName={catName(link.categoryId)}
                    testing={testingId === link.id}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(link.id)}
                    onToggleSelect={() => toggleSelect(link.id)}
                    onPlay={() => setPlaying(link)}
                    onTmdb={() => setQuickTmdb(link)}
                    onTest={() => void testLink(link)}
                    onOpenBrowser={() => window.open(link.url, '_blank', 'noopener')}
                    onEdit={() => {
                      setEditing(link)
                      setAddOpen(true)
                    }}
                    onDelete={() => {
                      if (window.confirm(`Remover "${link.name}"?`)) deleteLink(link.id)
                    }}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </main>

      {/* Modais */}
      <AnimatePresence>
        {addOpen && (
          <AddModal
            categories={data.categories}
            settings={data.settings}
            existingUrls={existingUrls}
            editing={editing}
            onAdd={addLink}
            onAddList={addList}
            onUpdate={updateLink}
            onClose={() => setAddOpen(false)}
          />
        )}
        {settingsOpen && (
          <SettingsModal
            settings={data.settings}
            onChange={setSettings}
            onExportJson={handleExportJson}
            onImportJson={(f) => void handleImportFile(f)}
            onRestoreDefault={() => void restoreDefaultList()}
            onClearTmdb={() => {
              resetTmdbCache()
              toast('Cache da TMDB limpo')
            }}
            onResetAll={() => {
              localStorage.clear()
              setData(loadData())
              toast('Todos os dados foram apagados')
            }}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        {playing && (
          <PlayerModal
            link={playing}
            settings={data.settings}
            onStatus={(status) => setLinkStatus(playing.id, status)}
            onClose={() => setPlaying(null)}
          />
        )}
        {quickTmdb && !settingsOpen && !addOpen && (
          <TmdbSearchModal
            initialQuery={quickTmdb.name}
            apiKey={data.settings.tmdbApiKey}
            language={data.settings.tmdbLanguage}
            onPick={(m) => {
              updateLink(quickTmdb.id, { metadata: m })
              setQuickTmdb(null)
              toast(`Metadados atualizados: ${m.title}`)
            }}
            onClose={() => setQuickTmdb(null)}
          />
        )}
        {logsOpen && <LogsModal onClose={() => setLogsOpen(false)} />}
      </AnimatePresence>

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm shadow-xl backdrop-blur ${
                t.kind === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-950/80 text-emerald-300'
                  : 'border-red-500/30 bg-red-950/80 text-red-300'
              }`}
            >
              {t.kind === 'ok' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              <span>{t.msg}</span>
              {t.action && (
                <button
                  onClick={t.action.onClick}
                  className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function MediaCard({
  link,
  catColor,
  catName,
  testing,
  selectionMode,
  selected,
  onToggleSelect,
  onPlay,
  onTmdb,
  onTest,
  onOpenBrowser,
  onEdit,
  onDelete,
}: {
  link: MediaLink
  catColor: string
  catName: string
  testing: boolean
  selectionMode: boolean
  selected: boolean
  onToggleSelect: () => void
  onPlay: () => void
  onTmdb: () => void
  onTest: () => void
  onOpenBrowser: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const poster = link.metadata?.posterPath
  const title = link.metadata?.title ?? link.name
  const initials = link.name.trim().slice(0, 2).toUpperCase()

  const statusIcon =
    link.status === 'ok' ? (
      <span className="flex size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
    ) : link.status === 'fail' ? (
      <span className="flex size-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
    ) : (
      <span className="flex size-2 rounded-full bg-zinc-500" />
    )

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', damping: 24, stiffness: 320 }}
      className={`group cursor-pointer rounded-2xl ${selectionMode && selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-ink' : ''}`}
      onClick={selectionMode ? onToggleSelect : onPlay}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-hairline bg-panel2 shadow-lg shadow-black/40">
        {poster ? (
          <img
            src={poster}
            alt={title}
            className="size-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className="flex size-full items-center justify-center transition duration-500 group-hover:scale-105"
            style={{ background: `linear-gradient(160deg, ${catColor}33, #0d0d16 70%)` }}
          >
            <span className="font-display text-5xl font-extrabold" style={{ color: catColor }}>
              {initials}
            </span>
          </div>
        )}

        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30 ${
            selectionMode ? 'opacity-90' : 'opacity-70 transition group-hover:opacity-100'
          }`}
        />

        {selectionMode && (
          <div className="absolute left-2.5 top-2.5 flex size-6 items-center justify-center rounded-md border border-white/25 bg-black/40 backdrop-blur">
            {selected && <Check size={14} className="text-accent-200" />}
          </div>
        )}

        <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
          {testing && <Loader2 size={13} className="animate-spin text-amber-300" />}
          {statusIcon}
        </div>

        {!selectionMode && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPlay()
            }}
            className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 opacity-0 backdrop-blur transition duration-300 hover:bg-white/25 group-hover:opacity-100"
            aria-label={`Assistir ${title}`}
          >
            <Play size={22} className="ml-1 text-white" />
          </button>
        )}
      </div>

      <div className="mt-2 px-0.5">
        <p className="min-w-0 truncate text-sm font-medium text-zinc-200 transition group-hover:text-white">{title}</p>
        <div className="mt-1 flex items-center gap-2 opacity-70 transition group-hover:opacity-100">
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
            style={{ color: catColor, background: `${catColor}1f` }}
          >
            {catName}
          </span>
          {link.metadata?.rating ? (
            <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
              <CheckCircle2 size={9} className="text-accent-300" /> {link.metadata.rating}
            </span>
          ) : null}
        </div>

        {!selectionMode && (
          <div className="mt-2 flex items-center gap-1 opacity-0 transition duration-200 group-hover:opacity-100">
            <CardAction onClick={onTmdb} title="Buscar no TMDB" icon={<Clapperboard size={12} />} />
            <CardAction onClick={onTest} title="Testar link" icon={<Activity size={12} />} />
            <CardAction onClick={onOpenBrowser} title="Abrir no navegador" icon={<ExternalLink size={12} />} />
            <CardAction onClick={onEdit} title="Editar" icon={<Pencil size={12} />} />
            <CardAction onClick={onDelete} title="Remover" danger icon={<Trash2 size={12} />} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

function CardAction({
  onClick,
  title,
  icon,
  danger,
}: {
  onClick: () => void
  title: string
  icon: ReactNode
  danger?: boolean
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={title}
      aria-label={title}
      className={`flex size-7 items-center justify-center rounded-lg border border-hairline bg-panel2 text-zinc-400 transition hover:text-white ${
        danger ? 'hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-400' : 'hover:bg-white/10'
      }`}
    >
      {icon}
    </button>
  )
}