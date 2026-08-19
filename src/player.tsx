import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileDown,
  Loader2,
  Play,
  RotateCcw,
  X,
} from 'lucide-react'
import type HlsType from 'hls.js'
import type { LinkStatus, MediaLink, Settings } from './types'
import { withWorker } from './cors'
import { downloadLogs, getLogs, log } from './logger'

interface PlayerModalProps {
  link: MediaLink
  settings: Settings
  onClose: () => void
  onStatus: (status: LinkStatus) => void
}

type PlayerStatus = 'loading' | 'playing' | 'click-to-play' | 'error'
type PlayMode = 'native' | 'hls-worker' | 'hls-direct' | 'hls-noreferer'

const MODE_LABELS: Record<PlayMode, string> = {
  native: 'Nativo',
  'hls-worker': 'Via Worker',
  'hls-direct': 'HLS direto',
  'hls-noreferer': 'Sem Referer',
}

export function PlayerModal({ link, settings, onClose, onStatus }: PlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<HlsType | null>(null)
  const [modeIdx, setModeIdx] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<PlayerStatus>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [playRetries, setPlayRetries] = useState(0)

  const modes = useMemo<PlayMode[]>(() => {
    const isPlaylist = /\.m3u8?($|\?|#)/i.test(link.url)
    if (!isPlaylist) return ['native']
    const m: PlayMode[] = []
    if (settings.workerUrl.trim()) m.push('hls-worker')
    m.push('native', 'hls-direct', 'hls-noreferer')
    return m
  }, [link.url, settings.workerUrl])

  const mode = modes[modeIdx] ?? modes[0]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let cancelled = false
    let hls: HlsType | null = null
    let fragCount = 0
    let lastSpamTs = 0

    setStatus('loading')
    setErrorMsg('')
    setPlayRetries(0)

    log('info', 'player', `Tentativa: ${MODE_LABELS[mode]} (${modeIdx + 1}/${modes.length})`, {
      nome: link.name,
      url: link.url,
    })

    const url = mode === 'hls-worker' ? withWorker(link.url, settings.workerUrl) : link.url

    const fail = (msg: string) => {
      if (cancelled) return
      log('error', 'player', msg)
      if (modeIdx + 1 < modes.length) {
        setModeIdx((i) => i + 1)
      } else {
        setErrorMsg(msg)
        setStatus('error')
        onStatus('fail')
      }
    }

    const videoLogger = (ev: Event) => {
      if (cancelled) return
      const now = performance.now()
      if (ev.type === 'error') {
        log('error', 'video', `evento de erro — code=${video.error?.code} msg=${video.error?.message ?? 'sem detalhe'}`)
      } else if (ev.type === 'waiting' || ev.type === 'stalled' || ev.type === 'emptied') {
        if (now - lastSpamTs > 5000) {
          lastSpamTs = now
          log('warn', 'video', `evento "${ev.type}" — readyState=${video.readyState} (ainda sem dados?)`)
        }
      } else {
        log('info', 'video', `evento "${ev.type}" — readyState=${video.readyState}`)
      }
    }
    const videoEvents = ['loadstart', 'loadedmetadata', 'canplay', 'playing', 'waiting', 'stalled', 'emptied', 'error'] as const
    for (const e of videoEvents) video.addEventListener(e, videoLogger)

    const onPlaying = () => {
      if (cancelled) return
      setStatus('playing')
      onStatus('ok')
    }
    video.addEventListener('playing', onPlaying)

    // ── Modo nativo: igual à barra de endereço (sem crossorigin, sem CORS) ──
    if (mode === 'native') {
      video.onerror = () => {
        if (cancelled) return
        const code = video.error?.code ?? '?'
        log('error', 'player', `Falha no caminho nativo (código ${code})`)
        if (code === 4) fail('Navegador não suporta este formato no modo nativo; tentando outras formas…')
        else fail('Falha nativa ao reproduzir o stream.')
      }
      video.src = url
      video.play().catch(() => {
        if (!cancelled) setStatus('click-to-play')
      })
    } else {
      // ── Modos hls.js: direto ou sem Referer ──
      const runHls = async () => {
        const { default: Hls } = await import('hls.js')
        if (cancelled) return
        if (!Hls.isSupported()) {
          fail('HLS não suportado neste navegador.')
          return
        }
        hls = new Hls({
          maxBufferLength: 30,
          backBufferLength: 60,
          fetchSetup: mode === 'hls-noreferer' ? (ctx, init) => new Request(ctx.url, { ...init, referrerPolicy: 'no-referrer' }) : undefined,
        })
        hlsRef.current = hls

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return
          log('info', 'hls', 'Manifesto HLS parseado')
          setStatus('playing')
          onStatus('ok')
          video.play().catch(() => {
            if (!cancelled) setStatus('click-to-play')
          })
        })
        hls.on(Hls.Events.LEVEL_LOADED, (_e, data) => {
          if (!cancelled && data.details) {
            log('info', 'hls', `Nível carregado: ${data.details.fragments.length} segmento(s), duração alvo ${data.details.targetduration}s`)
          }
        })
        hls.on(Hls.Events.FRAG_LOADED, (_e, data) => {
          fragCount++
          if (fragCount <= 3) {
            log('info', 'hls', `Segmento ${fragCount} baixado (${Math.round((data.frag.stats.loaded ?? 0) / 1024)} KB)`)
          }
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (cancelled) return
          log('error', 'hls', `erro ${data.type} — detalhe=${data.details} fatal=${data.fatal} status=${data.response?.code ?? '-'} msg=${data.err?.message ?? ''}`)
          if (data.fatal) {
            const msg =
              data.type === Hls.ErrorTypes.NETWORK_ERROR
                ? 'Falha de rede ao carregar o stream (fora do ar, bloqueio ou proxy inoperante).'
                : 'Falha ao decodificar o stream.'
            fail(msg)
          }
        })

        hls.loadSource(url)
        hls.attachMedia(video)
      }
      void runHls()
    }

    return () => {
      cancelled = true
      hls?.destroy()
      hlsRef.current = null
      video.onerror = null
      for (const e of videoEvents) video.removeEventListener(e, videoLogger)
      video.removeEventListener('playing', onPlaying)
      video.removeAttribute('src')
      video.load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link.url, modes, modeIdx, attempt])

  const tryPlay = () => {
    const video = videoRef.current
    if (!video) return
    setPlayRetries((r) => r + 1)
    const retry = playRetries + 1

    if (hlsRef.current && video.readyState < 2) hlsRef.current.startLoad()

    const p = video.play()
    if (p) {
      p.catch(() => {
        if (cancelledRef.current) return
        log('warn', 'player', `play() rejeitado — readyState=${video.readyState}, tentativa ${retry}`)
        if (video.readyState < 2 && retry >= 3) {
          setErrorMsg('O stream não entregou dados ao navegador (provável bloqueio ou sinal fora do ar).')
          setStatus('error')
        } else {
          setStatus('click-to-play')
        }
      })
    } else {
      setStatus('click-to-play')
    }
  }

  const cancelledRef = useRef(false)
  useEffect(() => {
    return () => {
      cancelledRef.current = true
    }
  }, [])

  const jumpTo = (m: PlayMode) => {
    const i = modes.indexOf(m)
    if (i >= 0) setModeIdx(i)
  }

  const openInBrowser = () => {
    window.open(link.url, '_blank', 'noopener')
  }

  const recentLogs = getLogs().slice(-40).reverse()

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-panel shadow-2xl shadow-black/60"
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 12 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-sm font-semibold text-white">
              {link.metadata?.title ?? link.name}
            </h2>
            <p className="truncate text-xs text-zinc-500">{link.url}</p>
          </div>
          <button
            onClick={openInBrowser}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/10 hover:text-white"
            title="Abrir no navegador"
          >
            <ExternalLink size={14} /> Abrir no navegador
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar player"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative aspect-video w-full bg-black">
          <video ref={videoRef} controls playsInline />

          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
              <Loader2 size={36} className="animate-spin text-accent" />
              <p className="text-sm text-zinc-400">
                Carregando stream… <span className="text-zinc-600">({MODE_LABELS[mode]})</span>
              </p>
            </div>
          )}

          {status === 'click-to-play' && (
            <button
              onClick={tryPlay}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 transition hover:bg-black/60"
            >
              <span className="flex size-16 items-center justify-center rounded-full bg-white/10 backdrop-blur">
                <Play size={28} className="ml-1 text-white" />
              </span>
              <p className="text-sm text-zinc-300">Clique para reproduzir</p>
            </button>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-black/70 px-6 py-6 text-center">
              <AlertTriangle size={36} className="shrink-0 text-red-400" />
              <p className="max-w-lg text-sm text-red-300">{errorMsg}</p>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setAttempt((a) => a + 1)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
                >
                  <RotateCcw size={15} /> Tentar novamente
                </button>
                {modes.map((m) => (
                  <button
                    key={m}
                    onClick={() => jumpTo(m)}
                    className="rounded-xl border border-hairline bg-panel2 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={openInBrowser}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-accent to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition hover:brightness-110"
                >
                  <ExternalLink size={15} /> Abrir no navegador
                </button>
                <button
                  onClick={downloadLogs}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-panel2 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
                >
                  <FileDown size={13} /> Baixar logs
                </button>
                <button
                  onClick={() => setShowDetails((s) => !s)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-hairline bg-panel2 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10"
                >
                  {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Detalhes técnicos
                </button>
              </div>

              {showDetails && (
                <pre className="max-h-56 w-full overflow-y-auto rounded-xl border border-hairline bg-black/60 p-3 text-left font-mono text-[10px] leading-relaxed text-zinc-400">
                  {recentLogs.length
                    ? recentLogs
                        .map(
                          (l) =>
                            `[${new Date(l.ts).toLocaleTimeString('pt-BR')}] [${l.source}] ${l.msg}` +
                            (l.data !== undefined ? ` ${JSON.stringify(l.data)}` : ''),
                        )
                        .join('\n')
                    : 'Nenhum log registrado ainda.'}
                </pre>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}