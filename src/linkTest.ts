import { fetchWithTimeout } from './cors'
import { log } from './logger'

export type TestErrorKind = 'cors' | 'timeout' | 'http' | null

export interface TestResult {
  ok: boolean
  mode: 'direct'
  status: number | null
  contentType: string | null
  acao: string | null
  bodyType: 'm3u8' | 'html' | 'valid' | 'invalid' | 'empty'
  preview: string
  elapsedMs: number
  errorKind: TestErrorKind
  errorMsg: string
}

function previewOf(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.slice(0, 90)
}

export async function testLinkDetailed(url: string): Promise<TestResult> {
  const t0 = performance.now()
  const base: TestResult = {
    ok: false,
    mode: 'direct',
    status: null,
    contentType: null,
    acao: null,
    bodyType: 'empty',
    preview: '',
    elapsedMs: 0,
    errorKind: null,
    errorMsg: '',
  }

  log('info', 'test', 'Testando link (modo: direto)', { url })

  try {
    const res = await fetchWithTimeout(url, 15000)
    const elapsedMs = Math.round(performance.now() - t0)
    const contentType = res.headers.get('content-type')
    const acao = res.headers.get('access-control-allow-origin')

    log('info', 'test', `Resposta recebida`, {
      status: res.status,
      content_type: contentType,
      acao,
      elapsed_ms: elapsedMs,
      final_url: res.url,
    })

    if (!res.ok) {
      const result: TestResult = {
        ...base,
        status: res.status,
        contentType,
        acao,
        elapsedMs,
        errorKind: 'http',
        errorMsg: `HTTP ${res.status} ${res.statusText}`,
      }
      log('error', 'test', `Falhou: HTTP ${res.status}`, result)
      return result
    }

    const looksLikePlaylist = /\.m3u8?($|\?|#)/i.test(url)
    let text = ''
    if (looksLikePlaylist) {
      text = (await res.text()).trimStart()
    }

    if (looksLikePlaylist) {
      const isM3u = text.startsWith('#EXTM3U') || text.startsWith('#EXT-X-')
      const isHtml = /^<!doctype html|<html/i.test(text)
      const result: TestResult = {
        ...base,
        ok: isM3u,
        status: res.status,
        contentType,
        acao,
        elapsedMs,
        bodyType: isM3u ? 'm3u8' : isHtml ? 'html' : 'invalid',
        preview: isM3u ? `#EXTM3U (${text.length} bytes)` : previewOf(text),
        errorMsg: isM3u ? '' : 'A resposta não é um manifesto HLS válido',
      }
      if (isM3u) log('info', 'test', 'Link OK: manifesto HLS válido', { length: text.length, elapsed_ms: elapsedMs })
      else log('error', 'test', 'Resposta não é HLS', result)
      return result
    }

    const isHtml = contentType?.includes('html')
    const result: TestResult = {
      ...base,
      ok: !isHtml,
      status: res.status,
      contentType,
      acao,
      elapsedMs,
      bodyType: isHtml ? 'html' : 'valid',
      preview: previewOf(text || contentType || ''),
      errorMsg: isHtml ? 'O servidor respondeu com uma página HTML (provável bloqueio)' : '',
    }
    log(result.ok ? 'info' : 'error', 'test', result.ok ? 'Link OK (mídia direta)' : 'Resposta HTML — bloqueio', result)
    return result
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - t0)
    const name = err instanceof DOMException ? err.name : err instanceof TypeError ? 'TypeError' : ''
    const isTimeout = name === 'AbortError' || name === 'TimeoutError'
    const result: TestResult = {
      ...base,
      elapsedMs,
      errorKind: isTimeout ? 'timeout' : 'cors',
      errorMsg: isTimeout
        ? 'Timeout: o servidor não respondeu em 15s'
        : 'Bloqueio de rede/CORS: o navegador impediu a requisição',
    }
    log('error', 'test', result.errorMsg, { name, elapsed_ms: elapsedMs, url })
    return result
  }
}