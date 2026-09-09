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

## Equipamentos, manobra de joelho e controles — validação local

- Cinco joelheiras permanentes, duplo toque para iniciar manobra, chopper incompatível e queda ao tentar no piso molhado. Nitro consumível por moto (2/3/5 cargas), B buzina, Q e provocações ocasionais com balões. Dois analógicos móveis e botão Nitro.
- Protocolo v6: catálogo/capacidades validados no servidor, fila de ações com ACK, estado de equipamentos compartilhado e recibos locais de consumo que resistem à reconexão. Compras permanecem no save local, sem autenticação de carteira no servidor.
- Build passou; 56 testes anteriores e nove novos passaram. Teste de navegador cobriu lojas, saves, cinco joelheiras, manobra, chuva, chopper, potência/consumo/pausa/reinício do nitro, som/evento de buzina, balões, multiplayer e reconexão.
- Toques simultâneos nativos via Chromium: direção e acelerador, dupla deflexão para a esquerda, liberação e pausa limpando dedos capturados; retrato e paisagem. O detector usa o timestamp do evento para não depender do atraso de processamento do navegador.
- Capturas de gameplay/loja foram inspecionadas. Balões acompanham a cabeça inclinada; texto de queda não sobrepõe o aviso principal. Relatório `output/equipment/browser-check.json`, sem erros JavaScript/console. A verificação pública será registrada após ativar a release.

### Equipamentos publicados e verificados

- Código `8730918`, release `20260908T212701Z-8730918` ativa. Asfalto, catálogo e Caddy ativos; health confirmou protocolo v6. Ativação respeitou a verificação de corridas ativas.
- HTTPS público: compras pela garagem, limite de nitro, manobra individual e balão. Sala entre subdomínio e domínio principal com dois humanos e seis bots confirmou equipamentos, ações compartilhadas, restrição de chopper e consumo persistido após reconexão sem débito duplicado.
- Os dois clientes saíram explicitamente. Nenhum erro JavaScript/console. Relatório `output/equipment/published-check.json`; capturas da garagem, manobra com balão e corrida online inspecionadas em `output/equipment/published-*.png` no projeto de origem.
- O domínio principal usou mapeamento DNS temporário no Chromium mantendo validação TLS. Conteúdo dos demais jogos e homepage preservado. Este registro posterior à release não requer nova ativação.

## Empinada e combate permanente — validação local

- Empinada por toque duplo no acelerador (teclado/analógico), três ativações por corrida, salto automático sobre um carro na contramão. Vans/caminhões/segundo carro continuam colidindo; sem proteção geral. Protocolo v7 preserva ações e usos na reconexão.
- Garagem Combate: garrafa $650/dano24, beisebol $1.500/dano38 e corrente $2.400/dano32, com alcance/cadência próprios. Equipamentos comprados permanecem salvos no v1 e não são roubados nem perdidos; disponíveis no individual e online.
- 73 testes passaram, incluindo corridas completas secas/chuvosas. Nova cobertura de salto, aterrissagem, três usos, consumo/reconexão, colisões e prisão, propriedades/danos/alcances e normalização no servidor. Revisão da prévia de ataque no salto validada com 14 testes de manobra/rede.
- Navegador: compras/persistência, três sprites de combate, empinada/salto/aterrissagem, pausa/reinício/exaustão, caminhão de teste, duplo gesto nativo no celular, dois humanos + seis bots, salto compartilhado e corrente a maior distância. Regressão de joelheiras/nitro/buzina/balões/analógicos também passou, sem erros JS/console.
- Capturas inspecionadas em `output/stunts-weapons/`. O caminhão está preparado para a futura pista Porto Ferrugem; o tráfego atual continua carros/vans. A aparição decorativa do homem pendurado permanece no planejamento do Porto, conforme escopo comunicado.
- A ativação e a verificação pública serão registradas após a publicação.


### Empinada e combate publicados

- Commit `46feaaf`; release `20260908T220022Z-46feaaf` ativa. Asfalto/Catálogo/Caddy ativos; health v7. A guarda de corridas ativas foi respeitada.
- HTTPS entre domínio principal e subdomínio: compras pela UI, salto e aterrissagem individual, dois humanos + seis bots, corrente causando dano, equipamentos distintos, empinada vista pelo outro cliente e reconexão mantendo identidade, três compras e dois usos restantes. Saída explícita dos dois clientes; nenhum erro JS/console.
- Relatório `output/stunts-weapons/published-check.json` e capturas da garagem, salto e sala online inspecionadas no projeto de origem. DNS do domínio principal mapeado temporariamente no Chromium, com validação TLS preservada. Nenhum conteúdo dos outros jogos/homepage foi alterado.
- Registro posterior à release; não requer nova ativação.

### Porto Ferrugem e preços publicados — 2026-09-08

- Código `feb576d`, release ativa `20260908T223915Z-feb576d`, protocolo v8. Asfalto/Catálogo/Caddy ativos e armazenamento em memória. Deploy protegido recusaria troca durante corridas; ativação ocorreu sem corridas ativas.
- Preços novos preservam propriedade anterior: Falcão $10.000, Estradeira $18.000, Veneno $30.000, Lobo $45.000, Agulha $65.000, Brutal $100.000; Ferro inicial.
- Porto Ferrugem (7,8 km): 11 curvas, três obras, cones/blocos, caminhões nos dois sentidos e cenário industrial nas quatro condições. Passageiro pendurado decorativo (33%, 8s) acompanha caminhão real. Campanha libera no Top 5 do Vale; recorde antigo por condição também libera.
- Validação local: build, 80 testes de jogo e 7 testes da VPS passaram. Sete modelos completaram Porto seco e molhado; navegador confirmou preços e compras de todas as motos, saves, quatro condições, aviso de obras, passageiro, pausa/reinício, layout móvel, 2 humanos + 6 bots, combate e reconexão. Imagens inspecionadas em `output/porto/` no projeto de origem.
- HTTPS/WSS público entre os dois domínios: compra da Falcão por 10 mil e preço da Brutal de 100 mil, desbloqueio via recorde legado, corrida individual Porto/Noite, mundo comum Porto/Chuva, dois humanos + seis bots, golpes e reconexão. Nenhum erro JS/console; saída explícita. Relatório `output/porto/published-check.json`; capturas publicadas inspecionadas.
- Comparação pública com oito conexões reais por sala, 5s de medição após largada: mediana dos intervalos 50,8–51,0ms na Costa e 50,7–50,8ms no Porto; confirmação de comandos 152,0–153,7ms e 157,1–157,9ms respectivamente. Estados com 9.418 bytes e 8.196 bytes medianos. São amostras da conexão de teste, sem garantia em redes externas. Relatórios `output/porto/network-costa.json` e `network-porto.json`.
- Chromium usou resolução temporária do domínio principal para a VPS com TLS validado. Homepage, outros jogos e placares sem mudanças de conteúdo. Registro posterior à ativação; não requer novo deploy.

### Avisos da joelheira removidos — 2026-09-08

- Código `2f109cc`, release `20260908T224457Z-2f109cc` ativa; protocolo v8 e três serviços saudáveis.
- A tentativa de manobra sem joelheira ou abaixo da velocidade mínima retorna silenciosamente. Requisitos da manobra e explicação na loja permanecem.
- Build/export e verificação local/HTTPS passaram: duplo toque sem equipamento, com equipamento em baixa velocidade e ativação válida em velocidade. Nenhum toast nos dois casos recusados, sem erros JS. Imagens inspecionadas, relatórios em `output/quiet-knee/` no projeto de origem.
- Ajuste publicado e conferido, sem pendências. Registro posterior à release, sem necessidade de nova ativação.


### Tolerância do joelho na chuva publicada — 2026-09-08

- Código `782ee62`, release `20260909T014846Z-782ee62` ativa, protocolo v9. Serviços Asfalto/Catálogo/Caddy ativos. Ativação respeitou a guarda de corridas ativas.
- Manobra mantém os 4s originais; a queda na chuva ocorre apenas após mais de 3s contínuos de contato. Levantar o joelho zera a exposição, pausar congela e reconectar preserva o estado. Sem novos avisos de requisito. Loja/ajuda atualizadas.
- Build e 83 testes passaram. Regressão no navegador cobriu equipamentos, controles móveis, pausa e rede. Dois humanos + seis bots confirmaram contato breve seguro, cancelamento, reconexão e queda compartilhada. Cliente da skill, estados e capturas inspecionados; relatórios em output/wet-knee e output/equipment no projeto de origem.
- HTTPS publicado confirmou manobra de 4s, 3s exatos seguros, queda no tick seguinte e reset ao levantar. Texto atualizado nos dois domínios. Sem erros JS/console, capturas publicadas inspecionadas em output/wet-knee/published-*.png; relatório published.json. Domínio principal usou DNS temporário no Chromium mantendo TLS válido.
- Concluído e publicado. Registro posterior à release, sem necessidade de redeploy.


### Contador de visitantes publicado — 2026-09-08

- Código `6d6ee04`; release `20260909T015809Z-6d6ee04` ativa, protocolo do jogo continua v9. Caddy validado e recarregado com a rota `/api/visitors`. Configuração anterior preservada em `/etc/caddy/Caddyfile.before-visitors-20260909T015809Z` e backup SQLite/config executado antes da atualização. Três serviços ativos, guarda de corridas respeitada.
- Contagem começou em `2026-09-09T01:58:18.314Z` (08/09 no Brasil), sem estimar tráfego anterior. SQLite mantém navegadores únicos com cookie anônimo assinado, compartilhado entre os dois domínios e renovado a cada visita. Recarregar/abrir outra aba não duplica; dispositivos, modo anônimo e limpeza/expiração podem contar novamente.
- Menu mostra frase singular/plural ou convite para o primeiro visitante, data inicial e informação de estimativa, abaixo da garagem. Nenhuma requisição por frame, sem bloquear corrida ou exigir serviço externo. Registros persistentes entram no backup diário existente.
- Build/export e nove testes do catálogo passaram: placares preservados, concorrência, cookies, dois domínios, reinício, restrições HTTP e limite de novos IDs. Navegador local confirmou primeiro acesso, recargas/abas, dois navegadores, três tamanhos móveis, ausência de sobreposição, largada/aceleração/pausa e resposta inválida sem bloquear o jogo.
- HTTPS nos dois domínios confirmou contador e data, celular e corrida individual/pausa, sem erros JS/console. QA público fez apenas GET via `?test`, sem cookies nem visitantes artificiais (total 0 nas verificações). Uma navegação inicial expirou; repetição com resolução temporária dos dois domínios para a VPS e TLS validado passou.
- Cliente da skill com o backend nativo já documentado passou no HTTPS público, aceleração/direção, estado e imagem revisados. Capturas locais/publicadas e relatórios em `output/visitors/` no projeto de origem, inspecionados. Concluído; documentação posterior não requer redeploy.


### Áudio de salto publicado — 2026-09-08

- Código `dace3a5`, release `20260909T020844Z-dace3a5` ativa. Serviços Asfalto/Catálogo/Caddy ativos, protocolo v9. Ativação respeitou a guarda de corridas ativas.
- Salto sobre carro toca impacto metálico curto uma vez e aumenta giro/brilho/volume do motor enquanto está no ar. Aterrissagem retoma o som normal. Fatores de timbre por moto preservados, integração individual/online sem mudança de física, manobra ou rede.
- Build/export e oito testes de manobra/armas passaram. Chromium local e HTTPS público verificaram nós Web Audio reais: frequência do motor cerca de 130Hz no chão, 275Hz no ar e 85Hz após aterrissagem na fixture; retorno suave, quatro ressonâncias de metal, uma ativação por salto, pausa/mute, snapshots repetidos, caminhão sem salto e reinício. Sem erros JS/console. Trata-se de verificação instrumental, não de avaliação auditiva subjetiva.
- Capturas de salto/pouso inspecionadas em output/jump-audio; relatórios local.json e published.json. QA público usou ?test sem aumentar visitantes. Cliente da skill com backend nativo já documentado executou largada/aceleração no HTTPS; imagem/estado inspecionados.
- Concluído, publicado e enviado ao GitHub. Registro posterior não exige nova ativação.


### Guard-rails sólidos publicados — 2026-09-08

- Código `a5f4c90`, release `20260909T025030Z-a5f4c90` ativa, protocolo v10. Asfalto/Catálogo/Caddy ativos. A ativação respeitou a guarda de corridas ativas; salas de teste encerradas explicitamente.
- Proteções desenhadas agora bloqueiam a moto e reduzem a velocidade por contato: Costa do Sol/Porto Ferrugem à esquerda, Serra da Fumaça nos dois lados. Não causam dano ou queda por si; virar para dentro libera o movimento. Laterais abertas preservadas. Geometria compartilhada com desenho, física, previsão e apresentação online. Obras mantidas.
- Build/export e todos os 89 testes passaram. Navegador local verificou Porto/Chuva, Serra nos dois lados, controles móveis, dois humanos + seis bots, posições remotas e reconexão; sem erros JS/console.
- HTTPS/WSS público entre domínio principal e subdomínio confirmou contato/velocidade/saída da proteção, obras, corrida individual e dois humanos, contenção remota e reconexão, sem erros JS/console. QA usou `?test`, sem aumentar visitantes. DNS temporário no Chromium manteve TLS validado.
- Relatórios e capturas em `output/guardrails/` no projeto de origem, inspecionados. Cliente da skill com backend nativo já documentado passou com aceleração/direção na Costa publicada; estado e imagem revisados. Concluído, publicado e enviado ao GitHub. Registro posterior não requer nova ativação.


### Áudio do guard-rail publicado — 2026-09-09

- Código `8e20908`, release `20260909T030557Z-8e20908` ativa. Protocolo v10 e física preservados. Asfalto/Catálogo/Caddy ativos; guarda de corridas respeitada, clientes de teste saíram explicitamente.
- Batida metálica curta no primeiro contato e raspagem contínua com volume/brilho acompanhando a velocidade. Duas bandas filtradas no loop reutilizado; histerese de 150ms evita repetir pancadas com pequenas correções online. Silencia ao afastar/parar/cair/sair/pausar; mute e reinício respeitados.
- Build/export e seis testes de guard-rail passaram. Chromium local e HTTPS/WSS nos dois domínios confirmaram nós Web Audio reais, impacto único, raspagem e volume (ganhos aproximados 0,220 a 45m/s e 0,103 a 10m/s), pausa/mute, snapshots repetidos, laterais abertas, fim/reinício e dois humanos sem sons indevidos no outro cliente. Sem erros JS/console. Primeira sonda online media após a moto já ter parado; corrigida para medir durante movimento. Regressão do áudio de salto também passou. Verificação instrumental, sem avaliação auditiva subjetiva.
- Relatórios e capturas locais/publicadas inspecionados em `output/guardrail-audio/` no projeto de origem. Cliente da skill com backend nativo já documentado executou largada/aceleração/contato na Costa publicada; estado em x=-7, saúde/integridade 100%, sem queda. Imagem/estado revisados, sem erros.
- QA público em `?test`, sem incrementar visitas; DNS temporário no Chromium com TLS validado. Concluído, publicado e enviado ao GitHub. Registro posterior não requer redeploy.


### Capacetes publicados — 2026-09-09

- Código `3618af7`, release `20260909T032811Z-3618af7` ativa. Protocolo v10 preservado, campos cosméticos opcionais. Asfalto/Catálogo/Caddy ativos. A ativação respeitou a guarda de corridas ativas; clientes de teste saíram explicitamente.
- Garagem → Capacetes: Integral incluído, Retrô 1.500, Cross 3.000 e Racing 5.000 créditos. Oito cores gratuitas, prévias frente/costas, compras permanentes e troca sem nova cobrança. Compatibilidade com todas as motos; geometria no piloto, rivais e retrovisor, incluindo empinada. Cache de pilotos limitado a 512 variantes.
- Save v1 mantém compras anteriores, recebe o básico ao migrar e normaliza IDs/cores/posse. Lobby/mundo/reconexão compartilham a seleção; bots têm variações determinísticas. A garagem continua local ao navegador/origem. Capacetes não mudam atributos nem RNG/física.
- Build/export e 93 testes passaram. Chromium local e HTTPS/WSS entre domínio principal e subdomínio verificaram compra dos três modelos, oito cores sem custo, reequipamento, saldo, joelheira preservada, recarga, layout móvel, chopper, retrovisor, dois humanos + seis bots e reconexão. Nenhum erro JS/console.
- Capturas locais/publicadas inspecionadas em `output/helmets/`, com 64 vistas dos modelos em sete estilos de moto e empinada. Relatórios `local.json` e `published.json`. Cliente da skill com backend nativo já documentado confirmou corrida, aceleração/direção e novo Integral branco publicado; imagem/estado revisados, sem erros.
- QA público em `?test`, sem aumentar visitas; DNS temporário no Chromium com TLS validado. Concluído, publicado e enviado ao GitHub. Registro posterior não requer nova ativação.


### Terra Brava publicada — 2026-09-09

- Código `03f1799`, release `20260909T040932Z-03f1799` ativa. Protocolo v11; Asfalto/Catálogo/Caddy saudáveis. A ativação respeitou a guarda de corridas, sem forçar reinício de partidas. As páginas precisam ser recarregadas para a versão nova; saves/compras v1 preservados.
- 7,2 km, uma faixa por sentido, doze curvas e relevo próprio. Seis barrancos alternados contêm e desaceleram sem dano/queda extra, com entrada gradual e áudio de terra/pedras. Tratores lentos em ambos os sentidos, colisão e retrovisor próprios, sem salto permitido; cascalho/lama deixam passagem. Cenário com cercas, casas/celeiros/feno/cata-ventos; quatro condições e Saci/Boitatá decorativos.
- Campanha libera Terra pelo top 5 no Porto, inclusive por recorde anterior. Online permite selecionar a pista diretamente, mantém mínimo de dois humanos, limite de oito e bots opcionais, sala de 60s/5s com todos prontos, largada em duas colunas. Física/previsão/apresentação compartilham o perfil.
- Build/export, 100 testes do jogo e nove da VPS passaram. Simulação percorreu a pista com sete motos no seco/chuva (133–192s na fixture de direção). Navegador local confirmou combate junto ao barranco, contenção remota e reconexão; regressão do áudio metálico das pistas antigas passou.
- HTTPS/WSS público nos dois domínios confirmou vinte rotas, quatro condições, desbloqueio por recorde anterior, garagem preservada, barrancos/áudio, tratores/retrovisor, folclore, celular, dois humanos + seis bots e reconexão. Nenhum erro JS/console. QA em `?test`, sem aumentar visitantes; DNS temporário no Chromium manteve TLS validado. Capturas e relatórios inspecionados em `output/terra/` da origem. Custo de desenho na amostra pública: Costa 13,2ms / Terra 14,5ms, sem promessa de taxa de quadros em outros dispositivos. Áudio verificado instrumentalmente.
- Cliente da skill preservou o loop de controles/tempo/captura, usando a variante de GPU nativa já necessária neste ambiente. Preambulo descartável restaura Terra via `__game` para testar a pista bloqueada em navegador limpo; a resposta read-only do catálogo foi simulada pois esse serviço não estava ativo localmente. Primeiro teste revelou apenas esse proxy ausente; rodada final sem erros em `output/terra/skill-final`, com aceleração/direção e recuperação após combate, imagem/estado revisados. Nenhuma mudança de produto para o harness.
- Concluído, publicado e enviado ao GitHub. Próxima pista planejada: Mata Fechada. O registro posterior não exige nova ativação.


### Dificuldade moderada publicada — 2026-09-09

- Código `1dad6e4`, release `20260909T043009Z-1dad6e4` ativa. Asfalto/Catálogo/Caddy saudáveis, protocolo v11, save v1. Ativação respeitou a guarda de corridas; clientes de teste encerraram as salas explicitamente.
- Rivais individuais ganharam ~2–3,3% de velocidade máxima, ainda abaixo de fábrica, e três especialistas usam joelheiras nas curvas secas pela manobra normal de quatro segundos. Equipamento progride com dificuldade; choppers/polícia não usam, chuva é feita em pé. Ritmo cauteloso ligeiramente maior. CPUs opcionais online ganham a técnica, mantendo atributos de fábrica. Nenhuma alteração nas motos, compras, joelheiras ou controles humanos.
- Build/export, 104 testes do jogo e nove testes da VPS passaram. Benchmark antes/depois de 30 corridas por versão: com primeira moto/dourada, média 1,8 → 2,4, 15/15 top 5 preservados, vitórias 5 → 1. Sem joelheira, média 4,87 → 5,33 e top 5 11 → 9; todas concluídas. Amostra automatizada no seco, sem golpes; não representa taxa de vitória humana.
- Chromium local e HTTPS/WSS entre os dois domínios confirmaram técnica visível, joelheira dourada humana, primeira moto/saldo intactos, pausa, chuva, celular, dois humanos + seis bots, equipamento compartilhado e reconexão. Manobra online em curva verificada com fixture autoritativa local; público verificou largada/equipamento/reconexão sem alterar servidor. Nenhum erro JS/console. Capturas/estados/relatórios inspecionados em `output/difficulty/` na origem.
- Cliente da skill com GPU nativa e preâmbulo descartável de curva preservou controles/tempo/captura, testou direção/aceleração/empinada e mostrou rival apoiando joelho, sem erros. QA público em `?test`, sem incrementar visitas, com DNS temporário e TLS validado.
- Concluído, publicado e salvo no GitHub. Recarregar a página carrega a atualização; compras existentes preservadas. Registro posterior não requer nova ativação.


### Joelho na chuva: 2 segundos publicados — 2026-09-09

- Código `1aaf6b2`, release `20260909T043450Z-1aaf6b2` ativa. Queda após ultrapassar 2s contínuos de joelho apoiado na chuva (tick 121), manobra de até 4s preservada. Textos da loja/tutorial/documentação ajustados. Protocolo v11/save v1; regra autoritativa, previsão continua sem confirmar queda.
- Build/export, 104 testes do jogo e nove da VPS passaram. Navegador local com dois humanos + seis bots confirmou contato breve seguro, reset ao levantar, queda compartilhada e reconexão preservando exposição; sem erros JS/console. Cliente da skill com GPU nativa preservou seu loop e acionou a manobra com teclas em fixture de curva molhada, mostrando contato/queda. Imagens/estados revisados.
- HTTPS público confirmou descrição de 2s na loja, segurança até exatamente 2s, pausa congelando contato e queda no tick seguinte. Sem erros JS/console; teste com `?test` sem registrar visita artificial, DNS temporário com TLS validado. Relatório/capturas em output/wet-knee na origem.
- Asfalto/Catálogo/Caddy saudáveis, nenhuma corrida ativa na verificação final. Guarda de partidas respeitada na ativação. Concluído, publicado e salvo no GitHub; recarregar a página carrega a versão nova. Registro posterior não requer redeploy.


### Rivais mais rápidos: segundo ajuste publicado — 2026-09-09

- Código `d6ccbaf`, release `20260909T123357Z-d6ccbaf` ativa. Teto dos rivais individuais em 98/99/100% de fábrica conforme o nível da pista, ganho relativo adicional de 1–3,2%. Ritmo de curva cauteloso/veloz/agressivo em 0,95/1,04/0,99. CPUs online usam a decisão de ritmo, mantendo motos de fábrica. Polícia, humanos, compras e joelho na chuva após 2s preservados. Protocolo v11/save v1.
- Build/export, 104 testes do jogo e nove da VPS passaram. Comparação com 1aaf6b2 em 30 corridas automatizadas por versão: primeira moto com dourada, média 2,4 → 2,87 e 15/15 top 5; sem joelheira, média 5,33 → 5,8 e top 5 9 → 5. Todas concluídas. Amostra no seco sem golpes, não previsão de desempenho humano.
- Chromium local e HTTPS/WSS nos dois domínios confirmaram velocidade nova, equipamento/primeira moto preservados, joelho visível, chuva, celular, pausa, dois humanos + seis bots e reconexão. Sem erros JS/console. Salas de teste encerradas explicitamente. Relatórios e capturas revisados em output/difficulty na origem; cliente da skill com GPU nativa preservou controles/tempo/captura e confirmou pilotagem com rival em curva, sem erros.
- Asfalto/Catálogo/Caddy saudáveis. Ativação respeitou a guarda de corridas. QA público em `?test` sem aumentar visitas, DNS temporário com TLS validado. Concluído, publicado e enviado ao GitHub; registro posterior não requer redeploy.


### Salas públicas publicadas — 2026-09-09

- Código `2e39891`, release `20260909T143614Z-2e39891` ativa. Opção Sala pública na criação, busca expansível e entrada sem digitar código. Públicas: 120s; privadas: 60s existentes; todos prontos: no máximo 5s. Mínimo de duas pessoas reais, máximo de oito e bots opcionais preservados. Campanha/save v1/física/equipamento intactos; protocolo v11 com campos opcionais.
- Build/export, 109 testes do jogo e nove testes da VPS passaram. Cinco testes novos cobrem prazos, saída durante a contagem, filtro de privadas/cheias/fechadas/inativas, dados públicos sem credenciais e admissão concorrente/HTTP. Redis descartável validou descoberta/entrada entre duas instâncias, teto de oito e reconexão. A implantação atual usa somente memória, sem chamadas Redis.
- Chromium local e HTTPS/WSS entre asfaltobruto.flowofdevelopment.com e flowofdevelopment.com confirmaram descoberta e entrada sem código, 120s, uma pessoa pronta sem largar, dois humanos + seis CPUs, todos prontos/5s, celular, corrida e reconexão. Convites privados de 60s, solo e save preservados. Local validou tentativa de entrada após encerramento da sala e nova criação na mesma tela. Sem erros JS/console. Capturas/relatórios em output/public-rooms na origem; telas de busca, criação no celular, espera e largada inspecionadas.
- Cliente da skill preservou loop de controles/tempo/captura com GPU nativa e confirmou aceleração/direção no individual. Captura e estado revisados, sem erros. QA público em ?test, sem incrementar visitas, com resolução DNS temporária e TLS validado. Salas de teste encerradas explicitamente.
- Guarda de corridas respeitada na ativação. Asfalto/Catálogo/Caddy saudáveis; código salvo no GitHub. Concluído e publicado. Este registro posterior não requer redeploy.


### Recuperação de interrupções publicada — 2026-09-09

- Código `adda59c`, release `20260909T145152Z-adda59c` ativa. HUD mostra Sincronizando após 750ms sem avanço recebido. Após 3s, retoma o mesmo piloto por nova conexão sem depender do fechamento do socket antigo. Oscilações breves não trocam socket; perda prolongada encerra tentativas em 15s e mostra Conexão perdida/volte ao menu. A corrida continua no servidor durante interrupções, como antes. Física, gameplay, campanha, equipamentos e protocolo v11 intactos.
- Relato compatível com oscilação de rede, sem afirmar a causa específica. VPS não apresentou queda, erro ou pressão de memória. Baseline local reproduziu tick parado por mais de 4,5s com WebSocket/ping ativos e HUD conectado; faltava detecção de ausência de avanço.
- Build/export, 109 testes e nove testes da VPS passaram. Driver dedicado injetou oscilação de 1,1s, retenção de snapshots com ping normal, interrupção de todo o tráfego e perda prolongada. Conferiu aviso, identidade preservada, orçamento de tentativas e volta ao solo. Regressão de salas públicas/120s/5s, privadas/60s, bots, celular, reconexão e save preservado passou, sem erros JS/console.
- QA HTTPS/WSS nos dois domínios reteve somente snapshots do navegador de teste; confirmou Sincronizando, reconexão automática e avanço da corrida com o mesmo ID. O segundo jogador continuou recebendo a corrida. Nenhuma falha foi injetada no servidor ou em jogadores reais. Capturas e relatório revisados em output/freeze. Testes públicos usaram ?test sem incrementar visitas, DNS temporário com TLS válido e saída explícita das salas.
- Cliente da skill validou aceleração/direção solo com GPU nativa e loop original de ações/capturas; screenshot/state revisados, sem erros. Primeira execução coincidiu com exportação em diretório observado pelo Vite e recebeu reload; repetida após exportar, passou. Guarda de corridas respeitada na ativação, serviços Asfalto/Catálogo/Caddy saudáveis. Publicado e salvo no GitHub; registro posterior não exige redeploy.

## 2026-09-09 — Conta Google e rankings preparados para ativação

- Release `20260909T171514Z-256c6c1`, código `256c6c1`. Conta opcional, importação explícita do legado, cache por conta/aba, CAS e recibos idempotentes, sessão Google/JWKS/nonce/CSRF, apelido público. Login de produção permanece desabilitado até configurar o ID público OAuth Web; nenhum login real ou dado de conta de teste inserido em produção.
- Ranking permanente individual/multiplayer separado por pista/condição e classificação por tempo/pontos. Solo por replay determinístico com limites e yield, multiplayer pelo resultado autoritativo e identidade privada do membro. Resultados deduplicados e pendências solo em IndexedDB. Migração aceita saldo legado do navegador; não é prova de origem da economia.
- 113 testes do jogo, nove VPS, build/export/bundle passaram. Teste completo em navegador local confirmou migração, compras entre dispositivos, equipamento, conflito, resposta perdida/reload sem duplicação, troca de conta, logout e corrida solo capturada/validada/persistida. Autenticação de teste usa somente injeção no processo local, sem bypass público. Skill nativa e regressões de salas públicas/reconexão passaram.
- QA HTTPS/WSS nos dois domínios: menus e filtros no desktop/celular, status Google aguardando configuração, política pública, solo/save convidado, multiplayer de duas pessoas/bots, 120s/5s, reconexão e convites privados preservados. Sem erros JS/console. Testes públicos em `?test` não aumentaram visitas; salas encerradas. Nenhuma conta/resultado fictício público.
- SQLite em `/var/lib/vibe-jogos/asfalto/accounts.sqlite`, fora das releases; diretório 700 e base600 do usuário vibe-asfalto, ReadWritePaths restrito. Ambiente preservado, sem rodar bootstrap completo. Backup diário passou a incluir accounts, integridade conferida na cópia aberta em modo leitura. Backup local à VPS; cópia externa não configurada.
- Guarda de corridas respeitada na ativação, serviços saudáveis. Próxima etapa: receber `GOOGLE_CLIENT_ID`, configurar origens e público no Google, ativar em janela sem corrida ativa e validar Google real entre dispositivos. Guia: `sources/asfalto-bruto/docs/conta-e-ranking.md`.

## 2026-09-09 — Cliente Google ativado

- Release `20260909T180405Z-b1f6295`, código `b1f6295`. ID público fornecido pelo usuário configurado no ambiente da VPS, com backup anterior e demais opções preservadas. Guarda de corridas respeitada; serviços saudáveis, integridade SQLite ok e acesso às chaves Google confirmado.
- Correção de nonce/CSRF ao retornar do popup, descarte de respostas anônimas anteriores ao login/logout e prevenção de renderização duplicada do botão Google. Teste novo reproduziu troca de nonce anterior; build, quatro testes de contas e navegador completo desktop/celular passaram, incluindo resposta de sessão atrasada após autenticação.
- HTTPS nos dois domínios confirmou ID esperado, botão oficial e abertura real da tela de e-mail/telefone em accounts.google.com, sem erro de origem/client ID. Testes em contextos descartáveis sem credenciais, sem autorizar conta ou importar progresso do usuário. Capturas revisadas em output/google-login na origem.
- Skill confirmou solo convidado, aceleração/direção e saldo preservado, sem erros. Nenhuma visita artificial (URLs ?test). Login pessoal e importação real devem ser realizados pelo usuário no navegador que já contém sua garagem; não foram executados pela automação.

### 2026-09-09 — HUD compacto e polícia no minimapa

- Código `3510830`; release `20260909T183746Z-3510830` ativa. Pista/condição abaixo do mapa, tempo/retrovisor/curvas/obras no topo. Sidebar e avisos em fluxo, com ajustes para desktop, celular em pé e deitado. Minimap mostra a polícia a até ±300m do piloto local, alternando vermelho/azul a cada 250ms; polícia não participa da classificação. Mapa curto reserva espaço para o trajeto e mantém distâncias à frente/atrás com setas desenhadas.
- Build/export, 114 testes do jogo e nove da VPS passaram. Teste novo cobre identidade local, alcance, ativação e exclusão de policiais eliminados. Chromium local confirmou 15 cenas em cinco viewports, nomes/condições/avisos longos sem sobreposição, pausa, duas fases do giroflex e desaparecimento fora do alcance. Regressão multiplayer com duas pessoas/bots, públicas/120s/5s, privadas, reconexão e solo passou. Skill nativa confirmou aceleração/direção, sem erros; screenshots/state revisados.
- HTTPS nos dois domínios confirmou as mesmas 15 cenas/cinco viewports por domínio, incluindo obras na chuva. Sem erros de JS/console. QA em contextos descartáveis com `?test`, GET de visitas, TLS validado e resolução DNS temporária. Nenhuma conta autenticada, progresso migrado ou resultado artificial enviado ao ranking. Artefatos na origem: `output/hud`, `output/hud/public`, `output/hud/public-root` e `output/public-rooms/local`.
- Guarda de corridas respeitada. Asfalto/Catálogo/Caddy ativos e saudáveis, nenhuma corrida ativa ao encerrar. Configuração Google, bancos persistentes, homepage Firebase, física, saves e protocolo v11 preservados. Portas temporárias 4384/4385 encerradas, porta local do usuário 4317 preservada. Registro posterior à publicação; não requer redeploy.

### 2026-09-09 — Chegada com torcida e câmera de vitória

- Código `3f98044`; release `20260909T193332Z-3f98044` ativa. Quatro carros, 18 espectadores e pórtico em arte original. Torcida comemora quando o primeiro colocado chega; somente o vencedor ergue os braços, inclusive jogadores humanos e os sete estilos de moto. Chuva/noite possuem guarda-chuvas/luzes. Após cruzar, câmera recua por 4,8s e o resultado aparece mantendo a cena ao fundo; Ver resultado/Enter/Esc permite antecipar. Opções de próxima corrida liberada, repetir pista/condição e menu. Multiplayer prepara uma nova sala e deixa a corrida dos demais continuar.
- Efeito estritamente visual: clones para estacionamento/movimento/câmera, sem modificar simulação, snapshots, replay, valores de chegada ou recompensas. Prêmio/ranking processados uma vez antes da apresentação. Prisão/destruição mantêm resultado imediato. Contas, bancos, equipamentos, economia e protocolo v11 preservados.
- Build/export, 117 testes do jogo e nove da VPS passaram. Três testes novos cobrem vencedor real, ausência de mutação e continuidade do segundo piloto online. Browser da chegada validou quatro viewports, vencedor/rival, navegação/última pista/desbloqueio, chuva/noite, perda sem comemoração, prêmio uma vez e dois jogadores com um terminando antes. Teste de conta com verificador exclusivamente local confirmou replay real capturado pelo navegador, resultado no ranking e persistência. HUD anterior passou nos 15 cenários/cinco telas. Sem erros JS/console.
- Skill com GPU nativa manteve os loops de ações/capturas: direção/aceleração e fixture de chegada somente no preâmbulo passaram por câmera em 1,75s/4,15s e resultado em 6,55s, saldo constante. Imagens/state e galeria da pose nas sete motos inspecionados. Artefatos na origem em `output/finish` e `output/accounts/browser`.
- HTTPS nos dois domínios passou nos cenários solo de quatro viewports, incluindo rival já comemorando, vitória do jogador, recuo, opções de navegação e ausência de duplicação do prêmio. Capturas revisadas em `output/finish/public` e `output/finish/public-root`. QA em contextos descartáveis com `?test`, TLS válido e DNS temporário; sem incrementar visitas, autenticar contas ou inserir resultados artificiais públicos.
- Guarda de corridas respeitada. Asfalto/Catálogo/Caddy saudáveis; nenhuma corrida ativa no fechamento. Homepage e ambiente Google intactos. Servidores de teste encerrados e porta local 4317 preservada. Registro posterior; não exige redeploy.

### 2026-09-09 — Bônus por recorde pessoal

- Código `ce09761`; release `20260909T194705Z-ce09761` ativa. Superar o melhor tempo pessoal individual da pista/condição paga 30% do prêmio anunciado, independente da posição. Primeira chegada, empate, tempo mais lento e falha não premiam. Bônus/tempo anterior/novo/total exibidos no resultado, compactados no celular curto. Multiplayer mantém economia existente.
- 122 testes unitários, nove VPS, build/export, browser de bônus, regressão de chegada solo/multiplayer e loop de controles da skill passaram. Liquidação não altera resultado autoritativo/snapshot/replay; dinheiro e recorde persistidos juntos. Normalização/CAS/recibo cloud validados em banco local descartável.
- Browser HTTPS nos dois domínios passou em quatro telas por domínio, incluindo reload, bônus de 420 somado aos 1120 do segundo lugar, casos sem bônus, separação pista/condição e visibilidade acima dos botões. Capturas públicas inspecionadas; sem erros JS/console. QA descartável em ?test, sem incrementar visitas/autenticar usuários/publicar resultados falsos.
- Ativação inicial recusada por corrida ativa; aguardado fim e usada ativação guardada normal. Asfalto/Catálogo/Caddy saudáveis, zero corridas na conferência. Configuração Google, save v1, protocolo11, bases e homepage preservados.

### 2026-09-09 — Pilotos tardios param na chegada solo

- Código `1a83e16`, release `20260909T214102Z-1a83e16` ativa. Corrigida extrapolação visual ilimitada: rivais que chegam após o player desaceleram e estacionam em posições distintas, sem alterar resultados/tempos oficiais, snapshot, prêmio, bônus ou estado online. Vencedor real continua comemorando.
- Teste reproduziu a falha anterior e passou com o ajuste. 124 unitários, nove VPS, build/export, browser local com solo/multiplayer e cinco iterações de controles/capturas da skill passaram. Permanência das vagas após dois minutos confirmada em teste.
- QA HTTPS nos dois domínios/quatro viewports passou; imagens após 10 e mais 20 segundos da chegada em segundo inspecionadas em desktop/celular. Rivais permanecem estacionados, pagamento e snapshot intactos. Sem erros JS/console, visitas artificiais ou resultados/contas de teste na base pública.
- Ativação guardada, serviços Asfalto/Catálogo/Caddy ativos e zero corridas no check final. Configuração OAuth, bancos, homepage e protocolo11 preservados.

### 2026-09-09 — Próxima corrida segue a numeração

- Código `8dd9de2`, release `20260909T214829Z-8dd9de2` ativa. Botão usa a mesma lista numerada do menu: Dia → Entardecer → Noite → Chuva → Dia da próxima estrada. Seleção e save atualizados juntos. Multiplayer prepara a próxima variante na tela de salas. Bloqueios de campanha, replay da mesma variante e fim da lista preservados.
- Build/export, nove testes VPS, browser local da chegada/multiplayer, regressão do bônus e skill com chegada→botão Próxima→direção em Entardecer passaram.
- QA HTTPS nos dois domínios passou, incluindo quatro viewports de chegada e ciclo completo Costa 01→02→03→04→Serra05, save/seleção/contador, variantes da última estrada e bloqueios. Imagens públicas inspecionadas; sem erros JS/console, visitas artificiais ou resultados fictícios no ranking.
- Ativação guardada, serviços saudáveis e zero corridas no check final. Sem mudança de física, economia, protocolo11, bancos, OAuth ou homepage.

### 2026-09-09 — Obstáculos por estrada e nova moto policial (preparado)

- Serra: três árvores ocupam três faixas e alternam faixa livre; empinada habilita salto por cima. Vale: cinco fenos rolantes e duas travessias de tatus; contato com tatu causa queda. Porto: dois bloqueios de meia pista com cinco carros parados cada, em sentidos opostos; outros veículos param ao alcançar a fila. Terra: quatro rampas de terra/lenha lançam sem gastar empinadas. Polícia tem máxima de 353km/h, acima de todas as motos com motor3+nitro, mantendo alvo próximo entre humanos/bots.
- Arte Canvas original, sombra/animação, direção dos carros parados e largura visual/física coerentes. Impacto de terra/madeira e motor solto nos saltos; salto sobre carro mantém som metálico. Física autoritativa comum a solo/online, relógio determinístico das travessias, previsão de rampas e retomada por snapshot. IA antecipa árvores a 220m e evita desviar para obstáculos.
- Protocolo12 impede clientes antigos de misturarem regras; classificação atual regras2, com consulta pública do histórico regras1. Nenhum resultado, garagem, saldo ou recorde pessoal apagado. OAuth/homepage/configuração de bancos permanecem.
- 133 testes unitários, nove VPS, build/export, browser dos obstáculos e regressões de armas/empinadas/áudio passaram. Browser com quatro condições da serra, desktop/celular, dois humanos + seis bots, salto observado nos dois clientes e reconexão. Ranking histórico consultado via API/SQLite descartável. Skill executou aproximação/salto/pouso com zero cargas; capturas/state revisados sem erros. Testes públicos/ativação pendentes.
