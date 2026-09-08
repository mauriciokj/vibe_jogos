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

## Domínio principal ativado — 2026-09-08, 19:02 UTC

O usuário alterou o A de `@` para `2.25.126.149`. Google e Cloudflare confirmaram o novo endereço; `www` permanece CNAME do domínio principal. O Caddy emitiu certificados Let's Encrypt para `flowofdevelopment.com` às 19:02:06 UTC e `www.flowofdevelopment.com` às 19:02:09 UTC, sem reiniciar os serviços.

- HTTPS dos dois hosts validado com verificação normal do certificado.
- HTML, JS, CSS e ícone da página inicial comparados byte a byte com o Firebase através de cada host; conteúdo preservado.
- HTML dos 13 pontos de entrada de jogos (12 do catálogo e Enduro legado) no domínio principal coincide com a release publicada. Catálogo, multiplayer e placares responderam corretamente nos dois hosts.
- Página inicial com dados do Firebase, catálogo e Xadrez renderizados e screenshots inspecionados, sem erros JavaScript ou respostas HTTP de erro.
- Partida cruzando os dois domínios: um navegador em `flowofdevelopment.com`, outro em `asfaltobruto.flowofdevelopment.com`, seis bots, início, curvas e reconexão validados.
- A conexão local ainda recebia respostas DNS antigas durante a propagação. Os testes HTTP usaram `curl --resolve` e os testes Chromium um mapeamento temporário de resolução para a VPS; a validação TLS ficou habilitada. Nenhuma configuração DNS/hosts permanente da máquina foi alterada. Algumas redes podem continuar acessando o destino anterior até seus caches expirarem.

Artefatos desta etapa em `road rash/output/domain-cutover/` e `road rash/output/vps/domain-http-check.json`.

## Pendente: placares históricos

Os placares históricos do Rio de Aço continuam no Upstash; a leitura permanece bloqueada pela cota. Nenhum registro antigo foi apagado. Importar esses dados quando o acesso for recuperado.

Artefatos locais estão em `road rash/output/vps/`: `live-check.json`, `eight.json`, `catalog-smoke.json`, `catalog-followup.json`, screenshots e `leaderboards-first-backup.sqlite` (arquivos de teste ignorados pelo Git).

## Condições de pista — validação local em 2026-09-08

- Expansão: Dia/Entardecer/Noite/Chuva nas três estradas existentes; aparição de sereia exclusiva da Costa, sem efeitos físicos; recordes por condição mantendo saves v1.
- Protocolo v5: condição da sala e tempo/local da aparição compartilhados. Mesma frenagem e aderência de chuva na simulação, bots e previsão local.
- Build TypeScript/Vite e 56 testes do jogo passaram. Corridas completas na chuva: Costa 183,9s / Serra 206,9s / Vale 241,5s com comandos limitados; condições secas mantêm resultados idênticos com a mesma seed.
- `test:conditions`: 12 cenários, menu em 1440×900 / 1280×720 / 390×844 / 375×667 / 844×390, pausa/reinício, seleção persistente, save anterior, dois navegadores + seis bots, golpes na chuva e reconexão. Nenhum erro no console.
- Cadência local de 120 quadros por condição: dia 59,0 FPS (p95 16,8ms), noite 60,0 FPS (p95 16,8ms), chuva 56,7 FPS (p95 33,3ms). Medição em Chromium automatizado, sem extrapolar para todos os dispositivos.
- Cliente original da skill executado com ações curtas; screenshot e estado revisados. Relatório local: `output/conditions/browser-check.json`, junto às imagens.
- Sete testes do catálogo/SQLite passaram. A publicação e a verificação HTTPS/WSS serão registradas abaixo após a ativação.

### Publicação confirmada

- Commit do jogo `8bd0b85`; release `20260908T201141Z-8bd0b85` ativa na VPS. Asfalto, catálogo e Caddy saudáveis. API pública em protocolo 5, `storage: memory`.
- HTTPS/WSS verificado entre o subdomínio Asfalto e o domínio principal na mesma sala: duas pessoas em Lobo/Falcão e seis bots, condição Chuva, controles reais atravessando a primeira curva, reconexão com mesma identidade/moto/condição e saída explícita. Nenhum erro de console.
- Mediana do intervalo entre snapshots 48,8–50,2ms; mediana da confirmação de comandos 183–192ms. Medição de renderização com dois Chromium: 53,5 FPS, p95 33,4ms. O pico do segundo cliente inclui a atualização de página/reconexão.
- Artefatos locais em `output/conditions/published-check.json`, `published-driving.json`, `published-corner.png` e `published-other-view.png`; imagens revisadas.
- Apenas documentação atualizada depois da release; nenhuma nova ativação necessária. Terra Brava e Mata Fechada permanecem etapas futuras do planejamento.

## Seleção unificada e correção de sobreposição — 2026-09-08

- Cada combinação de estrada e condição agora é um cartão próprio, com navegação lateral; criação de salas usa uma única lista com as mesmas 12 opções. Menu em fluxo flex/grid e rolagem vertical em janelas baixas. Save v1 preserva também a pista selecionada; protocolo continua v5.
- Build e 56 testes passaram. A migração de saves foi validada novamente após incluir cobertura da pista salva/ausente.
- Teste de navegador passou nas 12 combinações, bloqueios, recordes, pausa/reinício, escolha persistente e sete tamanhos (1440×900, 1280×720, 681×620, 681×420, 390×844, 375×667 e 844×390). Screenshots revisados; controles sem sobreposição, setas visíveis e seleção inteiramente visível na lista.
- Sala local com dois humanos e seis bots: chuva compartilhada, golpes autoritativos e reconexão preservando a linha do tempo decorativa, mesmo depois de sua aparição terminar. Nenhum erro de console. Relatório em `output/conditions/browser-check.json`.
- Publicação e verificação pública serão registradas após a ativação.

### Menu publicado e verificado

- Commit `3c14dac`; release `20260908T203652Z-3c14dac` ativa. Asfalto, catálogo e Caddy ativos; protocolo v5 e armazenamento em memória. A publicação respeitou a verificação de corridas ativas.
- HTTPS público: menu em 681×620 sem sobreposição, 12 cartões, bloqueios e seleção Costa do Sol · Noite preservada após atualizar a página; corrida individual iniciou com aceleração.
- Sala criada pelo seletor combinado em Serra da Fumaça · Chuva, com duas pessoas entre os dois domínios e seis bots. Ambos receberam pista/condição corretas; reconexão preservou identidade e escolha. Saída explícita dos dois clientes ao concluir. Sem erros JavaScript.
- Screenshots do menu, criação de sala e corrida revisados em `output/route-menu/published-*.png`; relatório `published.json`. Os testes do domínio principal usaram mapeamento DNS temporário no Chromium para a VPS, mantendo validação TLS.
- Esta anotação é posterior à release e não requer nova ativação.
