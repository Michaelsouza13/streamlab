import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, ExternalLink, FileDown, FileUp, KeyRound, RotateCcw, ScrollText, Trash2, X } from 'lucide-react'
import type { CorsProxyMode, Settings } from '../types'
import { PROXY_OPTIONS } from '../cors'
import { clearLogs, downloadLogs } from '../logger'
import { LogsModal } from './LogsModal'

interface SettingsModalProps {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onExportJson: () => void
  onImportJson: (file: File) => void
  onRestoreDefault: () => void
  onClearTmdb: () => void
  onResetAll: () => void
  onClose: () => void
}

const LANGUAGES = [
  { value: 'pt-BR', label: 'Português (BR)' },
  { value: 'pt-PT', label: 'Português (PT)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es-ES', label: 'Español' },
]

export function SettingsModal({
  settings,
  onChange,
  onExportJson,
  onImportJson,
  onRestoreDefault,
  onClearTmdb,
  onResetAll,
  onClose,
}: SettingsModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [logsOpen, setLogsOpen] = useState(false)

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
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-hairline bg-panel p-5 shadow-2xl shadow-black/60"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-white">Configurações</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <KeyRound size={12} /> Chave da API TMDB
            </label>
            <input
              type="password"
              value={settings.tmdbApiKey}
              onChange={(e) => onChange({ tmdbApiKey: e.target.value })}
              placeholder="Sua chave gratuita (v3 auth)"
              className={field}
            />
            <a
              href="https://www.themoviedb.org/settings/api"
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-accent-200 hover:text-white"
            >
              Obter chave gratuita no themoviedb.org <ExternalLink size={10} />
            </a>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Idioma dos metadados</label>
            <select
              value={settings.tmdbLanguage}
              onChange={(e) => onChange({ tmdbLanguage: e.target.value })}
              className={field}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Proxy CORS</label>
            <select
              value={settings.corsProxy}
              onChange={(e) => onChange({ corsProxy: e.target.value as CorsProxyMode })}
              className={field}
            >
              {PROXY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
              Use se os streams não carregarem por bloqueio do navegador. Proxies podem reduzir a velocidade e alguns
              serviços bloqueiam IPs de datacenter — nesse caso o player tenta direto primeiro.
            </p>
          </div>

          <div className="border-t border-hairline pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-600">Backup e dados</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onExportJson}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel2 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
              >
                <Download size={13} /> Exportar backup
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel2 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
              >
                <FileUp size={13} /> Importar backup
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Limpar o cache de buscas da TMDB?')) onClearTmdb()
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel2 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
              >
                <RotateCcw size={13} /> Limpar cache TMDB
              </button>
            <button
                onClick={() => {
                  if (window.confirm('Restaurar a lista padrão? Os canais já existentes não serão duplicados.')) {
                    onRestoreDefault()
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel2 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
              >
                <RotateCcw size={13} /> Restaurar lista padrão
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onImportJson(f)
                e.target.value = ''
              }}
            />
          </div>

          <div className="border-t border-hairline pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-600">Logs e diagnóstico</p>
            <p className="mb-2 text-[11px] leading-relaxed text-zinc-600">
              Registro das últimas 300 ações (testes de link, tentativas de reprodução, erros do hls.js). Útil para
              descobrir por que um stream não abre.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setLogsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel2 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
              >
                <ScrollText size={13} /> Ver logs
              </button>
              <button
                onClick={downloadLogs}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel2 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
              >
                <FileDown size={13} /> Baixar .txt
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Limpar todos os logs?')) clearLogs()
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-panel2 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
              >
                <Trash2 size={13} /> Limpar logs
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
            <button
              onClick={() => {
                if (window.confirm('Apagar TODOS os links, categorias e configurações? Essa ação é irreversível.')) {
                  onResetAll()
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 transition hover:text-red-300"
            >
              <Trash2 size={13} /> Apagar todos os dados
            </button>
          </div>
        </div>
      </motion.div>

      {logsOpen && <LogsModal onClose={() => setLogsOpen(false)} />}
    </motion.div>
  )
}