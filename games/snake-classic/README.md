# Snake Classic - Deploy

## Requisitos
- Este jogo é **estático** (HTML/CSS/JS), então o deploy é direto, sem build.

## Vercel (recomendado)
1) Importe o repo no Vercel.
2) Configure:
   - **Framework**: Other
   - **Root Directory**: `./`
   - **Build Command**: vazio
   - **Output Directory**: vazio
3) Deploy.

## URLs após deploy (monorepo)
- Home: `/`
- Snake: `/games/snake-classic/`

## Teste local rápido
```bash
python3 -m http.server 4174 --directory /Users/mauriciokj/projetos/vibe\ coding/Jogos
```
Acesse: `http://127.0.0.1:4174/games/snake-classic/`

## Observação
O deploy serve todos os jogos juntos (monorepo). A home principal lista os jogos.
