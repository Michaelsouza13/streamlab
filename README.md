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
- **Proxy CORS**: Configurações → Proxy CORS — para streams que bloqueiam o navegador. O player sempre tenta conexão direta primeiro (caminho nativo, sem CORS) e o botão "Abrir no navegador" é o fallback garantido.
- **Dados**: tudo fica no localStorage do navegador. Use Configurações → Exportar backup para guardar; Importar backup restaura.

## Logs

Últimas 300 ações (testes de link, tentativas de reprodução, erros hls.js/vídeo) ficam registradas. Acesse em Configurações → Logs e diagnóstico (Ver logs / Baixar .txt) ou pelo botão "Baixar logs" no overlay de erro do player.