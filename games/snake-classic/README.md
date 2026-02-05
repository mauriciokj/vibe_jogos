# Snake Classic - Deploy

## Requisitos
- O jogo é estático (HTML/CSS/JS), mas o placar global usa **API serverless**.

## Vercel (recomendado)
1) Importe o repo no Vercel.
2) Configure:
   - **Framework**: Other
   - **Root Directory**: `./`
   - **Build Command**: vazio
   - **Output Directory**: vazio
3) No Marketplace, crie **Upstash Redis** e conecte ao projeto (equivale ao KV antigo).
4) Deploy.

## URLs após deploy (monorepo)
- Home: `/`
- Snake: `/games/snake-classic/`
- API: `/api/leaderboard`

## Teste local rápido (estático)
```bash
python3 -m http.server 4174 --directory /Users/mauriciokj/projetos/vibe\ coding/Jogos
```
Acesse: `http://127.0.0.1:4174/games/snake-classic/`

## Teste local com placar global
- Requer Upstash Redis configurado via variáveis de ambiente.
```bash
vercel dev
```

### Variáveis necessárias (Vercel → Project → Settings → Environment Variables)
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

## Observação
O deploy serve todos os jogos juntos (monorepo). A home principal lista os jogos.
