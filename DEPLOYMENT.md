# Publicação dos jogos

## VPS central

- Servidor: `root@2.25.126.149`.
- Código: https://github.com/mauriciokj/vibe_jogos/tree/codex/vps-centralizacao
- Asfalto Bruto: https://asfaltobruto.flowofdevelopment.com/
- Outros jogos: `https://flowofdevelopment.com/<pasta-do-jogo>/` após o DNS principal apontar para a VPS.
- A página inicial atual é preservada por proxy para o Firebase, inclusive suas futuras atualizações.
- Catálogo: `/catalogo/`; acesso inicial por IP: http://2.25.126.149/.

A publicação na VPS é explícita: `npm run deploy:vps -- root@2.25.126.149` a partir de um checkout limpo. Consulte [infra/vps/README.md](infra/vps/README.md) para instalação, testes, backups, atualização e rollback. Push ao GitHub sozinho não atualiza a VPS.

## Hospedagem anterior

O projeto Vercel existente continua associado ao GitHub e à branch `main`, em https://vibe-jogos.vercel.app/. Ele não foi excluído. O ambiente VPS usa salas em memória e placares SQLite, sem chamadas ao Upstash. Os placares históricos do Rio de Aço ainda dependem de recuperar acesso ao Upstash para importação.
