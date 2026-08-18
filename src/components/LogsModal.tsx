import { useState } from 'react'
import { motion } from 'framer-motion'
import { ClipboardCopy, FileDown, RefreshCw, Trash2, X } from 'lucide-react'
import { clearLogs, downloadLogs, getLogs, logsToText } from '../logger'

interface LogsModalProps {
  onClose: () => void
}

export function LogsModal({ onClose }: LogsModalProps) {
  const [logs, setLogs] = useState(() => getLogs())
  const [copied, setCopied] = useState(false)

  const refresh = () => setLogs(getLogs())

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(logsToText())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard indisponível */
    }
  }

  const levelStyle = (level: string) =>
    level === 'error'
      ? 'bg-red-500/15 text-red-400'
      : level === 'warn'
        ? 'bg-amber-500/15 text-amber-300'
        : 'bg-white/5 text-zinc-400'

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="flex h-[70vh] w-full max-w-2xl flex-col rounded-2xl border border-hairline bg-panel shadow-2xl shadow-black/60"
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h2 className="font-display text-sm font-semibold text-white">
            Logs <span className="ml-1 text-xs font-normal text-zinc-500">({logs.length} entradas)</span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={refresh}
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              title="Atualizar"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => void copy()}
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              title="Copiar tudo"
            >
              <ClipboardCopy size={14} className={copied ? 'text-emerald-400' : ''} />
            </button>
            <button
              onClick={downloadLogs}
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              title="Baixar .txt"
            >
              <FileDown size={14} />
            </button>
            <button
              onClick={() => {
                if (window.confirm('Limpar todos os logs?')) {
                  clearLogs()
                  refresh()
                }
              }}
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-500/15 hover:text-red-400"
              title="Limpar"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-3">
          {logs.length === 0 && <p className="py-8 text-center text-sm text-zinc-600">Nenhum log registrado.</p>}
          {[...logs].reverse().map((l) => (
            <div key={l.id} className="flex items-start gap-2 rounded-lg border border-hairline bg-panel2 px-2.5 py-1.5">
              <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${levelStyle(l.level)}`}>
                {l.level}
              </span>
              <span className="mt-0.5 shrink-0 text-[10px] text-zinc-600">{new Date(l.ts).toLocaleTimeString('pt-BR')}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-300">
                  <span className="font-mono text-[10px] text-accent-300">{l.source}</span> {l.msg}
                </p>
                {l.data !== undefined && (
                  <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-snug text-zinc-500">
                    {JSON.stringify(l.data)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}