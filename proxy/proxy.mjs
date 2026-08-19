// proxy.mjs — proxy HTTP->HTTPS para streams IPTV (mixed content / CORS)
//
// Uso:   node proxy.mjs        (Node 18+)  |  deno run -A proxy.mjs
// Porta: 127.0.0.1:8787 (ajuste com env PORT / HOST)
//
// No app StreamLab: Configurações -> "URL do proxy próprio" -> http://127.0.0.1:8787
//
// Acesso do celular via Tailscale (no PC que roda o proxy):
//   tailscale serve --bg --https=443 http://127.0.0.1:8787
//   tailscale serve status   # copie https://<pc>.<tailnet>.ts.net
// Cole essa URL .ts.net no app — funciona de qualquer rede, com HTTPS válido.

import { createServer } from 'node:http'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '127.0.0.1'
const TIMEOUT_MS = 20_000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

function ts() {
  return new Date().toISOString().slice(11, 19)
}

function looksLikeManifest(url) {
  return /\.m3u8?($|\?|#)/i.test(url)
}

function rewrite(manifest, upstream) {
  const out = []
  for (const line of manifest.split(/\r?\n/)) {
    const t = line.trim()
    if (t.startsWith('#')) {
      if (t.startsWith('#EXT-X-KEY:')) {
        const uri = t.match(/URI="([^"]+)"/)
        if (uri) {
          const abs = new URL(uri[1], upstream).href
          out.push(t.replace(/URI="[^"]*"/, `URI="?u=${encodeURIComponent(abs)}"`))
          continue
        }
      }
      out.push(line)
      continue
    }
    if (t) {
      const abs = new URL(t, upstream).href
      out.push(`?u=${encodeURIComponent(abs)}`)
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

const server = createServer(async (req, res) => {
  const origin = `http://${req.headers.host ?? `127.0.0.1:${PORT}`}`
  const url = new URL(req.url ?? '/', origin)
  const t0 = Date.now()

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...CORS, 'Content-Length': '0' })
    res.end()
    console.log(`[${ts()}] OPTIONS ${req.url} -> 204`)
    return
  }

  const send = (status, body, kind, bytes) => {
    res.writeHead(status, body.headers)
    res.end(body.payload)
    console.log(
      `[${ts()}] ${req.method} ${url.searchParams.get('u') ?? req.url} -> ${status} ${kind ?? ''}${bytes ? ` (${(bytes / 1024).toFixed(0)} KB)` : ''} ${Date.now() - t0}ms`,
    )
  }

  const target = url.searchParams.get('u')
  if (!target) {
    send(400, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS, 'Cache-Control': 'no-store' },
      payload: 'proxy.mjs: use ?u=<url-encoded>',
    })
    return
  }

  let upstream
  try {
    upstream = new URL(target)
  } catch {
    send(400, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS, 'Cache-Control': 'no-store' },
      payload: 'URL inválida',
    })
    return
  }
  if (upstream.protocol !== 'http:' && upstream.protocol !== 'https:') {
    send(400, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS, 'Cache-Control': 'no-store' },
      payload: 'Protocolo não suportado',
    })
    return
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const resUp = await fetch(upstream, { redirect: 'follow', signal: ctrl.signal })
    const finalUrl = resUp.url || upstream.href
    if (!resUp.ok) {
      send(resUp.status, { headers: { ...CORS, 'Cache-Control': 'no-store' }, payload: null })
      return
    }
    const raw = Buffer.from(await resUp.arrayBuffer())
    const contentType = resUp.headers.get('content-type') ?? 'application/octet-stream'
    const isManifest = looksLikeManifest(finalUrl) || /mpegurl/i.test(contentType)
    const payload = isManifest ? Buffer.from(rewrite(raw.toString('utf8'), finalUrl), 'utf8') : raw
    send(200, {
      headers: {
        'Content-Type': isManifest && contentType.startsWith('application/octet-stream') ? 'application/vnd.apple.mpegurl' : contentType,
        'Content-Length': String(payload.length),
        ...CORS,
        'Cache-Control': 'no-store',
      },
      payload,
    }, isManifest ? 'm3u8' : 'segment', payload.length)
  } catch (err) {
    const msg = err?.name === 'AbortError' ? 'timeout' : (err?.message ?? 'erro desconhecido')
    send(502, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', ...CORS, 'Cache-Control': 'no-store' },
      payload: `Falha no upstream: ${msg}`,
    })
  } finally {
    clearTimeout(timer)
  }
})

server.listen(PORT, HOST, () => {
  console.log(`proxy.mjs ouvindo em http://${HOST}:${PORT}`)
  console.log(`Para acessar do celular: tailscale serve --bg --https=443 http://${HOST}:${PORT}`)
})