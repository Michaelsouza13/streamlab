# StreamLab — Player M3U8

Player de listas M3U/M3U8 com categorias, metadados TMDB, teste de links e logs de diagnóstico.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # gera a pasta dist/ (build estático pronto para hospedar)
npm run lint
```

## Lista padrão

O arquivo `public/default-playlist.m3u8` viaja junto com o build. No primeiro acesso (sem dados salvos), o app importa essa lista automaticamente na categoria "Canais ao vivo". Para restaurar manualmente: Configurações → Backup e dados → "Restaurar lista padrão" (faz merge, sem duplicar URLs).

Para atualizar os canais padrão: edite `public/default-playlist.m3u8`, rode `npm run build` e faça o deploy de novo.

## Como subir no Netlify (drag & drop — sem Git)

1. Rode o build:

   ```bash
   npm run build
   ```

2. Abra `https://app.netlify.com/drop` (ou "Add new site" → "Drag and drop your site folder") no seu navegador.

3. Arraste a pasta **`dist`** para o painel. Pronto — o site fica no ar com HTTPS automático em `https://<nome>.netlify.app`.

4. Para atualizar depois: rode `npm run build` novamente e arraste a pasta `dist` outra vez (replaces o site).

Obs.: o `netlify.toml` só é usado se um dia conectar o repositório ao Netlify (build `npm run build`, publish `dist`). No drag & drop ele não interfere.

## Configurações importantes

- **Chave TMDB** (gratuita em themoviedb.org): Configurações → Chave da API TMDB. Fica salva no navegador de cada usuário.
- **Proxy próprio**: Configurações → URL do proxy próprio — necessário para streams que redirecionam para HTTP (ver seção abaixo). Vazio = desativado.
- **Dados**: tudo fica no localStorage do navegador. Use Configurações → Exportar backup para guardar; Importar backup restaura.

## Proxy próprio (streams bloqueados)

Alguns canais (ex.: `3xdglab.me`) respondem com um redirecionamento para um IP **sem HTTPS** (`http://216.106.176.111:80/...`). O app roda em HTTPS (Netlify), então o navegador bloqueia essas requisições como *mixed content*, e o servidor IPTV não envia headers CORS — o link só funciona em aba (navegação top-level). O proxy resolve isso buscando tudo do lado do servidor e entregando por HTTPS com `Access-Control-Allow-Origin: *`.

O campo **Configurações → URL do proxy próprio** aceita qualquer URL de proxy; quando preenchido, o player tenta por ele primeiro. Há duas formas de rodar:

### Local via Tailscale (recomendado — sem cotas, banda ilimitada)

1. No PC que vai ficar de servidor, confira/instale o Node.js 18+:

   ```powershell
   node --version          # se falhar:
   winget install OpenJS.NodeJS.LTS
   ```

2. Copie a pasta `proxy/` para o PC e rode:

   ```powershell
   node proxy\proxy.mjs    # escuta em http://127.0.0.1:8787
   ```

   (Também roda com `deno run -A proxy.mjs`.)

3. Exponha via Tailscale (com Tailscale logado no PC e no celular):

   ```powershell
   tailscale serve --bg --https=443 http://127.0.0.1:8787
   tailscale serve status        # copie https://<pc>.<sua-tailnet>.ts.net
   ```

4. No app: Configurações → URL do proxy próprio → cole a URL `https://<pc>.<sua-tailnet>.ts.net`. Funciona do PC e do celular, de qualquer rede (Tailnet), com certificado HTTPS válido renovado automaticamente.

Observações:
- O PC precisa ficar ligado/acordado enquanto você assiste (ambiente Windows: ajuste "dormir após" nas opções de energia).
- O script não tem cotas: use quanto quiser.
- (Opcional) Início automático com o Windows: Abra o Agendador de Tarefas → Criar tarefa → disparador "No logon" → ação `node` com argumentos `C:\caminho\proxy\proxy.mjs` → marque "Executar mesmo sem o usuário estar conectado" (precisa de senha de administrador na criação).

### Nuvem via Deno Deploy (fallback quando o PC está desligado)

1. Em `https://dash.deno.com` crie um projeto ("New Project" → "Playground").
2. Cole o conteúdo de `proxy/proxy.mjs` no editor e clique em Deploy.
3. Copie a URL gerada (`https://<projeto>-<usuario>.deno.net`) e cole em Configurações → URL do proxy próprio.

Limites do plano Free (2026): 1M requests/mês, **20 GB de egress/mês** (≈ 12–13h de stream ativo), 15h de CPU. Ao estourar qualquer limite os apps são **pausados até o próximo ciclo mensal**. Limites completos exigem verificação com cartão. Pro: US$ 20/mês (200 GB).

### Aviso sobre proxies públicos

Proxies CORS públicos (corsproxy.io, cors.eu.org, etc.) não são suportados: a maioria morreu ou retorna 403/erros, e com o proxy próprio eles ficam desnecessários. Para testes rápidos, "Abrir no navegador" no player continua sendo o fallback garantido.

## Logs

Últimas 300 ações (testes de link, tentativas de reprodução, erros hls.js/vídeo) ficam registradas. Acesse em Configurações → Logs e diagnóstico (Ver logs / Baixar .txt) ou pelo botão "Baixar logs" no overlay de erro do player.