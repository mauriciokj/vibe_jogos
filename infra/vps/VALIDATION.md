# Validação da VPS — 2026-09-08

Release em execução: `20260908T184536Z-2827421`, código `28274213245016aded76bed7b175d851d22b598b`.

- HTTPS público validado em `asfaltobruto.flowofdevelopment.com`, certificado Let's Encrypt.
- 12 jogos do catálogo abriram sem erros de JavaScript ou requisições HTTP. O Enduro legado adicional também iniciou após corrigir seu import para `games/enduro-proto/Game.js`.
- Partida individual do Asfalto iniciou pelo menu e instruções. Cliente original da skill executado com screenshot inspecionado.
- Dois navegadores, Lobo/Falcão, seis bots: prontos, início, frenagem na primeira curva, progresso e reconexão preservando jogador/moto. Nenhum erro. Renderização média de 58,4 FPS no navegador de teste.
- Oito clientes WebSocket por 12 segundos: aproximadamente 20 snapshots/s; idade da simulação no servidor p95 de 16,3 ms. RTT mediano observado de 133 ms a partir da conexão de teste. Esses valores não representam uma promessa de latência para outras conexões nem um teste de capacidade de múltiplas salas.
- 50 testes do Asfalto e 7 testes de API/SQLite passaram. SQLite reteve escritas concorrentes, separação diária e dados após reabrir o banco.
- Serviços Node 22 em usuários distintos, portas 4318/4320 apenas no loopback, firewall ativo. Sem reinícios inesperados nos testes. Memória observada após partida: aproximadamente 35 MB no Asfalto e 16 MB no catálogo.
- Backup SQLite executado, integridade verificada e uma cópia trazida para a máquina local. Timer diário ativo; retenção de 14 dias no servidor.
- A configuração do domínio principal foi testada usando seu cabeçalho Host através do HTTPS já disponível. HTML, JS, CSS e ícone da página inicial coincidem byte a byte com os arquivos atuais do Firebase. Não houve alteração no projeto `flowofdevelopment/game-platform` nem em sua base de usuários/jogos.

## Pendente de ação externa

O A de `flowofdevelopment.com` ainda retornava `199.36.158.100` ao concluir os testes. Para ativar as rotas `/nome-do-jogo/` no domínio principal, trocar o A de `@` para `2.25.126.149`; `www` pode permanecer CNAME do domínio principal. Depois da propagação, validar certificado e as rotas públicas do domínio principal. O Asfalto e o catálogo no subdomínio já estão acessíveis.

Os placares históricos do Rio de Aço continuam no Upstash; a leitura permanece bloqueada pela cota. Nenhum registro antigo foi apagado. Importar esses dados quando o acesso for recuperado.

Artefatos locais estão em `road rash/output/vps/`: `live-check.json`, `eight.json`, `catalog-smoke.json`, `catalog-followup.json`, screenshots e `leaderboards-first-backup.sqlite` (arquivos de teste ignorados pelo Git).
