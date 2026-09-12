Original prompt: Build a classic Snake game in this repo.

- Placar global movido para API serverless em Vercel (`/api/leaderboard`) usando Vercel KV.
- Adicionado `package.json` com dependência `@vercel/kv`.
- README do Snake atualizado com passos de deploy e KV.
- README atualizado para Upstash Redis (Marketplace) e variáveis necessárias.
- Adicionado `.env.example` com chaves do KV/Upstash.
- Novo jogo iniciado em `games/cacto-escalador` com prototipo de escalada infinita e mecanica de espinhos por contato.
- Cacto Escalador: prototipo validado com Playwright (troca de lado, game over por contato prolongado, reinicio).
- Cacto Escalador recebeu aumento de dificuldade, novos obstaculos (spike/shard/rotor) e pickups de bonus/freio.
- Cacto Escalador: adicionado pickup de turbo para aumentar velocidade temporariamente e barra Turbo no HUD.
- Iniciada versao Phaser em `games/cacto-escalador-phaser` preservando o jogo vanilla existente.
- Criada versao Phaser em `games/cacto-escalador-phaser` com validacao Playwright (estado + screenshot).
- Novo jogo Phaser criado em `games/sombra-escala-phaser` com conceito de escalar sombras em movimento.
- Core loop implementado: movimentacao apenas sobre sombra, salto entre silhuetas e troca periodica de luz apagando caminhos.
- Hooks de automacao adicionados no novo jogo: `window.render_game_to_text` e `window.advanceTime(ms)`.
- Link do novo jogo adicionado ao `index.html` raiz.
- Sombra Escala validado com cliente Playwright via `file://` (ambiente recusou localhost durante os testes).
- Artefatos salvos em `output/web-game/sombra-escala` e `output/web-game/sombra-escala-shift`.
- Sombra Escala recebeu rework de design e mecanica para o conceito de sombras projetadas com exposicao letal e bonus por faiscas.
- Ajuste adicional no Sombra Escala: retorno para visual escuro e correção de perda instantanea ao iniciar.
- Versao Phaser recebeu polimento (particulas, squash/stretch e audio procedural).
- Phaser: adicionado pickup de escudo com invulnerabilidade de 10s ou consumo no primeiro impacto.
- Novo jogo iniciado em `games/river-raid-3d`: Rio de Aço 3D, inspirado em River Raid.
- Implementadas câmeras Chase/Top-Down, combate, inimigos, combustível, pontes, vidas e HUD em um único HTML.
- Rio de Aço 3D atualizado com navios em patrulha lateral e terceira câmera interna estilo cockpit.
- Rio de Aço 3D: helicópteros alinhados à patrulha lateral e faróis náuticos adicionados às pontes.
- Rio de Aço 3D: pontes agora avançam o ciclo Dia/Entardecer/Noite/Neblina/Inverno; faróis persistem e veículos usam luzes de navegação em baixa visibilidade.
- Rio de Aço 3D: faróis agora varrem o cenário com canhões rotativos; navios têm holofote frontal e helicópteros usam busca vertical sobre o rio.
- Roadmap de futuras mecânicas do Rio de Aço registrado em `games/river-raid-3d/IDEIAS.md`.
- Domínios de produção da Vercel registrados em `DEPLOYMENT.md`; publicação vinculada ao push da branch `main`.
- Vercel Web Analytics integrado ao catálogo e a todas as páginas HTML dos jogos por meio de `/_vercel/insights/script.js`.
- Analytics validado localmente nas oito páginas com o cliente Playwright; catálogo e jogos renderizaram sem regressões visuais. Os únicos 404 observados são preexistentes no leaderboard local do Snake e na página de backup `legacy-root`.
- Deploy de produção do Analytics verificado em `https://vibe-jogos.vercel.app/`: endpoint da Vercel respondeu 200 e as sete páginas públicas passaram no Playwright sem erros de console.
- Sugestão: acumular cerca de 30 dias de tráfego antes de decidir formatos e posições de anúncios.
- Rio de Aço 3D: primeira ideia do roadmap concluída com aceleração/frenagem por inércia, potência persistente e velocidade real entre 16 e 58; controles e câmeras revalidados sem erros.
- Rio de Aço 3D: segunda ideia do roadmap concluída localmente com câmeras dinâmicas, rastros de velocidade, exaustão variável, velocímetro responsivo e motor procedural; aguarda teste/aprovação antes do commit.
- Rio de Aço 3D: terceira ideia concluída localmente com lançadores nas pontes após o primeiro ciclo ambiental, mísseis teleguiados básicos, evasão por velocidade e destruição preventiva; aguarda teste/aprovação antes do commit.
- Rio de Aço 3D: regras locais ajustadas para conceder uma vida por ciclo ambiental completo, penalizar em 250 pontos a destruição de FUEL e acelerar o reabastecimento; validação concluída, ainda sem commit.
- Rio de Aço 3D: quarta ideia concluída localmente com alerta de travamento, direção da ameaça, alarme progressivo, luz no Cockpit e abatimento de mísseis por 200 pontos; aguarda teste/aprovação.
- River Raid 3D: mísseis ficaram mais rápidos e responsivos (15–36 unidades/s, curva de 2,65 rad/s); impacto e abatimento defensivo validados sem erros.
- River Raid 3D: travamento ampliado para 150 unidades, mísseis elevados a 32–62 e velocidades próprias de navio/helicóptero moduladas pelas cinco fases ambientais; testes passaram sem erros.
- River Raid 3D: física dos mísseis corrigida para somar o avanço do mundo a uma propulsão constante, eliminando a impressão de recuo em alta velocidade; baixa/alta velocidade e abatimento validados.
- River Raid 3D: modo de segurança de mísseis, faróis de ponte direcionais, bônus de velocidade dos helicópteros por ponte e navios com holofote/canhão após três ciclos implementados e validados sem erros.
- River Raid 3D: faróis agora memorizam o primeiro travamento e continuam apontando para o avião após o disparo e mesmo depois da destruição da ponte.
- River Raid 3D: seletor persistente de rodada inicial (01–10) adicionado ao menu para simular rapidamente desbloqueios, vidas, pontes, mísseis e combate naval.
- River Raid 3D: navios armados agora só rastreiam e atiram numa faixa lateral próxima, com 0,65 s de alerta; cruzar pelo outro lado do rio cancela o ataque.
- River Raid 3D: alcance de detecção e disparo dos navios agora corresponde exatamente às 22 unidades do próprio feixe de luz; fora dele não há alerta nem tiro.
- River Raid 3D: bônus local de `EVASÃO PERFEITA` concede 350 pontos quando um míssil passa a até 4,8 unidades sem atingir o avião; cenários próximo, distante e impacto foram validados.
- River Raid 3D: seletor de rodada agora é um modo secreto persistente, revelado por cinco cliques rápidos no título; bloqueio, desbloqueio, rodada 4 e recarga foram validados.
- River Raid 3D: roadmap ampliado com ranking online por nome, ambiente desértico, caça perseguidor, trem armado lateral e tanques atirando das margens.
- River Raid 3D: bioma Jungle adicionado ao roadmap com floresta densa, chuva tropical, canais estreitos, ruínas e emboscadas camufladas.
- River Raid 3D: biomas reorganizados por progressão — ciclos 1–2 permanecem no Vale Verde, ciclo 3 desbloqueia Deserto e ciclo 4 desbloqueia Jungle; cada bioma terá cinco fases próprias de horário/clima.
- River Raid 3D: combo local por destruições consecutivas implementado com janela de 4,5 s, multiplicador até ×5, HUD regressivo e resets por FUEL, expiração ou perda de vida.
- River Raid 3D: bônus local `RASANTE PERFEITO` concede 200 pontos por sustentar voo rápido próximo à margem; progresso, reentrada, duas margens, pausa e colisão foram validados.
- River Raid 3D: versionamento semântico iniciado em `v1.0.0`, com versão visível na tela, exposta para testes e documentada em changelog.
- River Raid 3D: `v1.1.0` local adiciona bônus `PONTE NO LIMITE` de 500 pontos para destruições a até 16 unidades do avião; ideia de bônus por facho foi descartada.
- River Raid 3D: `v1.1.0` aprovado no commit `7f693f3`; `v1.2.0` local adiciona `TURBO SCORE ×1,5` a partir de 52 unidades/s, combinado com combos e validado em inimigos, mísseis, pontes, pausa e viewport móvel.
- River Raid 3D: `v1.2.0` aprovado no commit `0d95bcf`; `v1.3.0` local adiciona bifurcações procedurais com dois canais, ilha central, colisões, reaparecimento seguro, navios por canal e reunião gradual do rio.
- River Raid 3D: bifurcações da `v1.3.0` ajustadas para começar somente na rodada 2, durar 280 unidades e abrir canais bem mais largos antes do surgimento da ilha.
- River Raid 3D: `v1.3.0` aprovada no commit `774f3ba`; `v1.4.0` local diferencia as bifurcações entre rota FUEL e rota de combate ×1,35, alternando os lados a cada evento.
- River Raid 3D: removida da `v1.4.0` a linha marrom no rio único, causada pelas paredes da ilha sendo renderizadas com largura zero; a bifurcação continua aparecendo normalmente.
- River Raid 3D: `v1.4.0` aprovada no commit `fa7d909`; `v1.5.0` local adiciona tanques nas margens a partir da rodada 3, com mira telegrafada, canhão evitável, três pontos de vida e recompensa de 450 pontos.
- River Raid 3D: na `v1.5.0`, tanques também podem ocupar ilhas centrais largas a partir da rodada 5; rodadas 3 e 4 continuam usando somente as margens.
- River Raid 3D: `v1.5.0` publicada em produção pelo commit `19ea18a`; `v1.6.0` local adiciona o Deserto a partir da rodada 3 com cinco fases, cactos, areia, menos FUEL e mais tanques.
- River Raid 3D: `v1.6.0` aprovada no commit `28fbd96`; `v1.7.0` local adiciona a Jungle na rodada 4 com cinco fases, floresta densa, canais mais estreitos, chuva tropical, névoa e balanceamento próprio de FUEL e tanques.
- River Raid 3D: mira dos tanques ajustada na `v1.7.0` para confirmar o alvo antes do disparo e lançar projéteis com vetor fixo em linha reta, permitindo esquiva lateral clara.
- River Raid 3D: `v1.7.0` publicada pelo commit `c99b918`; `v1.8.0` local adiciona Trem Armado na rodada 4 com evento lateral, aviso de lado, canhão evitável, seis pontos de vida e recompensa de 900 pontos.
- River Raid 3D: Trem Armado da `v1.8.0` redesenhado para atravessar pontes ferroviárias alternadas da direita para a esquerda, substituindo o percurso paralelo à margem.
- River Raid 3D: projéteis dos tanques corrigidos na `v1.8.0` para avançar em relação ao terreno mesmo na velocidade máxima; câmera Top-Down, três velocidades e esquiva com mira fixa foram validadas sem erros.
- River Raid 3D: `v1.8.0` registrada no commit `7650019`, enviada para `origin/main` e verificada em produção na Vercel.
- River Raid 3D: `v1.9.0` adiciona o Caça Perseguidor na rodada 5, com perseguição de 5 segundos, enquadramento de fuga, míssil perto do fim, flare contextual por `E`/toque e bônus de 1.000 pontos.
- River Raid 3D: `v1.10.0` adiciona barrel roll defensivo por `Q`, proteção de 0,9 segundo contra projéteis e um uso recarregado a cada fase ambiental.
- River Raid 3D: `v1.11.0` adiciona ranking global isolado por jogo no Vercel KV, Top 5 no menu, envio de nome e estatísticas no Game Over e fallback persistente offline.
- River Raid 3D: `v1.11.1` local estabiliza a memória gráfica com reutilização de terreno, pools de tiros/partículas, descarte de recursos, atualização incremental de biomas, HUD a 20 Hz e menor custo em telas Retina.
- Sinuca iniciada em `games/sinuca/index.html` como arquivo único: canvas responsivo, bolas numeradas com volume 3D, física elástica com correção posicional, substeps adaptativos, atrito, tabelas, seis caçapas, turnos contra CPU, menu, placar e reinício.
- Sinuca: primeira inspeção Playwright confirmou menu e mesa; margens do canvas e ordem visual do HUD foram ajustadas, e o triângulo passou a usar distância de dois raios com epsilon microscópico anti-sobreposição.
- Sinuca: sem TODOs funcionais pendentes após a validação final.
- Sinuca: testes automatizados validaram arraste/mira, bloqueio de segunda tacada, break, distância mínima entre bolas, choque elástico frontal, reflexão nas tabelas, correção de sobreposição, reposição da branca, pontuação, continuação de turno e tacada da CPU sem erros de console.
- Novo jogo iniciado em `games/xadrez-3d`: xadrez 3D autocontido em um único HTML, sem bibliotecas externas.
- Arcana Xadrez 3D concluído: WebGL2 direto, geometria procedural, sombras, regras oficiais completas, SAN, engine alfa-beta assíncrona e UI; regras raras e interação validadas no Playwright sem erros.
- Novo jogo iniciado em `games/luta-pixel`: luta 2D lateral com quatro personagens originais em pixel art, seleção, rounds, IA e golpes especiais.
- Novo jogo criado em `games/ruptura-fps`: FPS tático de sobrevivência autocontido com raycasting 3D, três armas, ondas, drones com A*/percepção/memória/cobertura/coordenação, áudio procedural e painel F1.
- Ruptura: movimento usa substeps e resolução iterativa de contatos para impedir tunneling e deslizar em quinas; inclui degrau automático, rampas caminháveis e declive íngreme com escorregamento.
- Ruptura: testes Playwright validaram movimento contra obstáculo (parada em x=6,28), automática, projétil carregado, escopeta de 9 pellets, ADS, estados de recarga, painel F1 e ausência de erros de console.
- Artefatos de QA do Ruptura salvos em `output/web-game/ruptura-clean`, `output/web-game/ruptura-debug.png` e execuções auxiliares `ruptura-*`.

## 2026-09-08 — Centralização na VPS

- VPS 2.25.126.149: Ubuntu, Node 22, Caddy, firewall e usuários isolados. Publicação por releases atômicas, verificação de saúde, rollback e recusa durante corridas ativas.
- Asfalto em processo único com estado em memória explícito em produção; Vercel continua exigindo Redis. Health informa armazenamento e corridas ativas. Proxy confiável limitado ao loopback.
- Placares Snake/Rio de Aço em SQLite com escritas serializadas, persistência e backup diário. 50 testes do jogo e 7 testes de API/SQLite passaram; build passou.
- 14 pastas de jogos incluídas, com URLs curtas /<jogo>/; bibliotecas Phaser/Three locais. Site principal existente preservado por proxy ao Firebase fir-d4471.web.app, conforme pedido do usuário.
- Branch de infraestrutura codex/vps-centralizacao em mauriciokj/vibe_jogos. Checkout original de Jogos e mudanças locais do River Raid não alterados.
- Em validação: deploy real, HTTPS, navegadores, sala com 8 participantes e troca do DNS principal. Histórico do Rio de Aço permanece no Upstash, leitura bloqueada pela cota antiga.

### VPS publicada e validada

- Release 20260908T184536Z-2827421 ativa, branch codex/vps-centralizacao enviada ao GitHub. HTTPS Asfalto + catálogo /catalogo/ disponíveis.
- 12 jogos do catálogo sem erros de carregamento; Enduro legado adicional corrigido e iniciado. Partida individual preservada, 2 navegadores + 6 bots e benchmark de 8 clientes concluídos. Detalhes em infra/vps/VALIDATION.md.
- Arquivos da página inicial preservados byte a byte via proxy Firebase; fonte e Firestore não alterados.
- Pendências externas: A de @ ainda 199.36.158.100; usuário recebeu instrução para 2.25.126.149. Verificar HTTPS principal depois da mudança. Histórico River Raid preso na cota Upstash, não apagado.

### DNS principal e HTTPS concluídos — 2026-09-08

- Usuário alterou A de @ para 2.25.126.149; Google/Cloudflare confirmaram. Certificados públicos de flowofdevelopment.com e www emitidos automaticamente às 19:02 UTC.
- Homepage, arquivos e dados do Firebase preservados; catálogo e Xadrez verificados visualmente sem erros. HTML dos 13 pontos de entrada de jogos corresponde à release na VPS.
- Corrida entre domínio principal e subdomínio com 2 navegadores + 6 bots, curvas e reconexão passou. Serviços não reiniciados.
- Propagação ainda apresentava cache antigo na conexão local; testes apontaram temporariamente para a VPS mantendo a validação TLS. Nenhuma ação adicional de DNS necessária. Detalhes em infra/vps/VALIDATION.md.
- Única pendência da migração de dados: recuperar placares históricos do Rio de Aço quando o Upstash permitir leitura.

## 2026-09-09 — Asfalto Bruto: quedas aprovadas e integradas
- Aprovação explícita após teste manual da chuva. Integrados deslizamento separado, câmera fixa, corpo com volume, corrida a pé nos dois sentidos, montagem, atropelamento, salto sobre motos caídas e explosão ao pegar moto com integridade0.
- Fonte canônica em `/Users/mauriciokj/projetos/road rash`; prévia4390 continua isolada e seus atalhos, saldo/save de teste e serviços desativados não entram neste release.
- Multiplayer protocolo13: predição de corpo/moto com correção suave e fases confirmadas no servidor; reconexão e comandos expirados tratados. Campeonato retoma checkpoint caído com integridade0. Contas/garagem e banco preservados.
- Ranking atual regras3; históricos2/1 disponíveis sem apagar resultados anteriores. Replay determinístico e checkpoint autenticado entre dispositivos verificados.
- Validação:173 testes na suíte completa e19 contas/campeonato/replay após novo caso, total174 casos; build/export TypeScript/Vite;9 testes VPS. Browser individual/celular e2 humanos+6 bots com latência/jitter, reconexão, atropelamento, salto e explosão. Cliente da skill e screenshots revisados; console sem erros. Produção será ativada com guarda de corridas e verificada via HTTPS.

## 2026-09-09 — Ativação e QA público das quedas
- Código `ddfdb19` publicado na release `20260910T024150Z-ddfdb19`, com guarda de corridas respeitada. Asfalto/Catálogo/Caddy ativos, protocolo13 e nenhuma corrida ativa após a verificação.
- Ambos os domínios entregam `index-BShO43jD.js` com SHA256 idêntico ao build local. QA HTTPS completo passou: chuva/câmera/busca, explosão, checkpoint0 do campeonato, mobile/joelho, histórico, chegada e próxima condição. Screenshots revisadas, nenhum erro JS/console; contextos descartáveis ?test sem ranking/visitas artificiais.
- WebSockets reais pelos dois domínios: sala privada com2 pessoas, todos prontos, largada e movimento confirmados; saída explícita ao terminar. Nenhum resultado de teste entrou no ranking. Conta/garagem, bancos, catálogo e demais jogos preservados. Aprovação implementada e publicada, sem pendências desta entrega.

## 2026-09-10 — Beta 1.1.0: economia da conta e histórico
- A edição de localStorage permitia substituir o save da conta. Usuário confirmou confiança na base beta atual; migração registra `beta_baseline` uma vez, sem zerar garagens. `/save` completo bloqueado; operações de compra, reparo, equipamento e preferências são calculadas no servidor, com revisão e recibo idempotente.
- Corridas individuais/campeonato enviam comandos para checkpoints conferidos. Prêmio, nitro, integridade e pontos são liquidados uma única vez em transação. Retomada, reinício, abandono e pendências após falha de rede tratados. Convidado permanece local; novas contas não importam saves arbitrários.
- Multiplayer14 consulta motos/equipamentos da conta e reserva nitro; falha de entrada/saída devolvem somente o estoque não consumido. Convidados usam Ferro/equipamento básico. Regras3 do ranking e resultados existentes preservados; campeonato continua separado da classificação livre.
- Versão do produto 1.1.0-beta visível no menu e API de saúde, com histórico por publicação antiga e revisão real. Página de privacidade e documentação do vídeo atualizadas.
- 180/180 testes unitários passaram, incluindo API autenticada, migração, compra duplicada, checkpoint/recompensa, campeonato e WebSocket com fraude/reserva. Browser desktop,390px e320px passou com duas contas de navegador, compra com resposta perdida, reload adulterado, corrida real conferida, campeonato retomado, reinício/abandono e convidado. Cliente da skill e imagens revisados. Build/export e9/9 testes de VPS passaram.
- Backup remoto concluído antes da ativação; serviço antigo saudável e sem corrida multiplayer ativa. Próximo passo: publicar commit/release e conferir migração, assets e interfaces públicas sem criar contas/resultados de teste em produção.

## 2026-09-10 — Beta1.1.0: ativação e QA público
- Commit de código `d061978`, release `20260910T140919Z-d061978` ativa. Backup prévio concluído; guarda de corridas respeitada. Serviços Asfalto/Catálogo/Caddy ativos. SQLite íntegro e zero diferenças entre save/revisão da base beta e contas após migração, sem reset.
- Dois domínios confirmam appVersion1.1.0-beta, protocolo14 e asset `index-CdOUMMS8.js` com SHA256 `1046ebb1160e6ce7c529c20d15eccffa7b963164e0cdaa3e35405204a12160d8`, idêntico ao build.
- Histórico/menu responsivo e corrida solo conferidos no HTTPS. WebSockets pelos dois domínios criaram uma sala privada, deram pronto, largaram e avançaram juntos; saída explícita. Sem contas falsas, resultados de teste no ranking ou visitas artificiais. Console/JS sem erros; capturas públicas revisadas.
- Testes locais180/180, infraestrutura9/9 e navegador completos. Economia/versão entregues. Limites e manutenção documentados em `sources/asfalto-bruto/docs/progresso-autoritativo.md`; protótipo4390 segue separado.

## 2026-09-10 — Beta1.1.1: menu sem rolagem vertical
- Menu dimensionado pela altura disponível: título, espaçamentos e cartões menores; troféu do campeonato preservado. No celular deitado, pistas ao lado dos modos de jogo. Versão clicável e visitantes no rodapé.
- 24 cenários de viewport/textos, de320x568 e568x320 até1920x1080, sem overflow vertical ou sobreposição. Garagem, conta, ranking, multiplayer, campeonato, ajuda, histórico/foco, carrossel, largada, pausa e retorno ao menu passaram; sem erros de console/JS. Imagens e estados conferidos; cliente da skill com corrida em movimento passou.
- TypeScript/Vite e export passaram. Física, contas, protocolos e ranking sem mudanças. Preparando ativação e verificação pública; publicação respeita a guarda de corridas ativas.

- Código `f5fc3cf`, release `20260910T183221Z-f5fc3cf` ativa. Asfalto/Catálogo/Caddy saudáveis; appVersion1.1.1-beta/protocolo14. Ambos os domínios entregam JS `index-D7ZNLmqh.js` e CSS `index-L9hSRFDI.css` idênticos ao build.
- QA HTTPS repetiu24 verificações de viewport/textos e navegação de menus/corrida/retorno; sem rolagem vertical, sobreposição ou erros JS/console. Imagens públicas conferidas. ?test sem visitas artificiais, conta ou ranking de teste. Trabalho concluído; QA4325/4382 encerrado e protótipo4390 preservado.

## 2026-09-10 — Beta1.2.0: prisão, motivos e obras do Porto
- Investigação: não existe eliminação exclusiva do Porto; regra existente prende quedas a até30m de um policial. Sem dados para afirmar o motivo das duas perdas antigas. Testes confirmam recuperação normal sem polícia próxima em todas as pistas.
- Câmera reiniciada após carregar a próxima corrida, corrigindo posição de queda reaplicada durante a espera pelo servidor; relógio reiniciado também descarta a recuperação anterior. Campeonato apresenta motivo antes da tabela e salva causa da prisão/explosão com cada corrida, compatível com saves antigos.
- Cena de prisão de6,4s: câmera recua, policial estaciona, desce, caminha e algema. Fonte visual é cópia do resultado oficial; sem alterar física, dados ou prêmios. No multiplayer, outros pilotos continuam normalmente. Confirmação da conta não reinicia a animação.
- Porto tem6 trabalhadores nas obras e2 sinalizadores PARE ao lado do primeiro carro das filas nos dois sentidos. Elementos visuais sem colisão.
-185/185 testes passaram; navegador validou prisão por queda/devagar, fases/algemas, desktop/mobile, pular, próximo grid, motivo no campeonato após reload, quatro condições nas obras e multiplayer com segundo humano ainda correndo. Imagens/estados/client skill conferidos, sem erros JS/console. Build/export aprovado; protocolo14/ranking3 preservados. Preparando publicação com guarda de corridas.

- Publicado37b9b3e na VPS na release20260910T191751Z-37b9b3e. Asfalto/Catálogo/Caddy ativos; Beta1.2.0/protocolo14 nos dois domínios. JS index-HeNVCaBs.js e CSS index-CoS8UUoQ.css idênticos ao build local. QA HTTPS completo passou, imagens públicas desktop/celular conferidas, sem erros JS/console ou gravação de contas/rankings de teste.
- Correção da migração: usuário identificou builds legados da Vercel. Status público confirmou dois autodeploys do GitHub, vibe-games/vibe-jogos, embora publicação manual use deploy:vps. vercel.json passa a ter git.deploymentEnabled=false; exportador mantém bloqueio. Branches antigas sem esse campo podem continuar disparando builds: documentada desconexão no painel de ambos os projetos para cessar todas as branches. Não alterados projetos Vercel, DNS ou dados. Configuração e registro posteriores não precisam de redeploy da VPS.

## 2026-09-10 — Beta1.2.1: compras de joelheiras em sequência
- Nova compra exige a cor imediatamente anterior: branca → verde → azul → roxa → dourada. Regra compartilhada na garagem, compra convidada e API da conta. UI explica bloqueio e servidor rejeita compra fora da ordem antes de alterar saldo. Joelheiras antigas continuam disponíveis, sem conceder itens anteriores gratuitamente.
-21 testes direcionados passaram. QA navegador conferiu saldo suficiente sem liberar cores, sequência completa, recarga, trocas gratuitas, joelheira antiga, corrida equipada, desktop/celular, API autoritativa e progresso em outro dispositivo. Build/export aprovados; Beta1.2.1 no histórico, preços/física/protocolos mantidos. Autodeploy Vercel segue desativado; preparação para publicar na VPS.

- Códigoe52ac14 publicado somente na VPS: release20260910T194051Z-e52ac14, serviços Asfalto/Catálogo/Caddy saudáveis. Dois domínios entregam Beta1.2.1/protocolo14 e JS index-_Njob3DB.js/CSS index-CoS8UUoQ.css idênticos ao build. QA HTTPS sequência/recarga/legado/mobile/corrida e cliente da skill com aceleração/direção passaram. Imagens e estados conferidos, sem erros JS/console, sem contas/rankings/visitas de teste em produção. Servidores QA encerrados; protótipo4390 preservado. Nenhum status/deployment Vercel no commit. Entregue; registro posterior não requer redeploy.

## 2026-09-10 — Beta1.2.2: moto equipada e avisos da garagem
- Reproduzida Veneno19% confirmada na garagem sendo trocada por Ferro na largada. Removida a troca automática de motos abaixo de20%, tanto no cliente convidado quanto no servidor. Moto escolhida com integridade positiva permanece na corrida, com aviso de desgaste. Moto comprada em0% exige reparo ou outra seleção; assistência gratuita da Ferro só quando ela foi escolhida.
- Erros de compra/equipamento agora aparecem dentro da garagem, acima do backdrop, com botões atualizados após conflito de revisão. Erros de largada não são mais ocultados ao mostrar o menu. Aviso explica a moto inscrita no campeonato quando difere da seleção livre; regras da etapa/retomada preservadas.
-47 testes direcionados passaram. QA navegador de conta local: sete motos, prévia/recarga/sem cobrança, largada com19%, corrida pendente recusando troca com motivo visível, conflito de revisão e retry, moto0% sem gastar/criar corrida, reparo e largada. Convidado/campeonato/celular conferidos visualmente, sem erros JS. Teste legado bikes-browser tem expectativa antiga de convidado usar moto comprada online, regra que mudou em Beta1.1.0; física/autorização não alteradas para fazê-lo passar.
- Build/export Beta1.2.2 aprovado. Correção reproduzida pode explicar o relato, mas usuário ainda não confirmou o cenário exato. Preparando deploy VPS com guarda de partidas; Vercel desativado, protótipo4390 e dados reais preservados.

- Publicado códigoa1d405e na VPS, release20260911T002503Z-a1d405e. Asfalto/Catálogo/Caddy ativos; Beta1.2.2/protocolo14, assets index-BkwMBmSf.js e index-C6NaOxsX.css idênticos ao build nos dois domínios.9 testes VPS passaram. QA HTTPS desktop/celular confirmou seleção/recarga, Veneno19% na largada, bloqueio em0% e reparo seguido de largada correta. Cliente da skill com aceleração/direção passou; imagens e estados conferidos. Sem erros JS/console ou contas/rankings/visitas de teste em produção. Nenhum status/deployment Vercel no commit. QA local encerrado, protótipo4390 preservado. Entregue; registro posterior não exige redeploy.

## 2026-09-12 — Beta1.3.0: bicicleta secreta
- Magrela desbloqueada gratuitamente e permanentemente ao cair e cruzar a chegada caminhando, em qualquer pista/clima e modo de corrida. Não troca o veículo equipado. Cartão preto com apenas “item ainda não disponível” antes da conquista; mensagem na chegada e bicicleta disponível depois.
- Pedalar exige novos toques em W/↑ ou no alto do analógico do celular. Esforço curto, reserva limitada, freio cancela esforço; segurar e repetição automática do teclado não sustentam a velocidade. Arte original em Canvas, pedais/pernas animados, quadro e raios, versões frontal/traseira/parada e retrato. Sem motor/nitro/joelheira/empinada por toque duplo; transmissão pode receber melhorias.
- Conquista confirmada por replay no servidor para conta individual/campeonato e pela simulação da sala no multiplayer. Posse salva com o resultado, recibos idempotentes, compra antecipada recusada. Protocolo15 sincroniza pedaladas confiáveis com ACK; ranking3 e progresso antigo preservados. Sete bots mantêm os modelos e atributos existentes.
-200/200 testes do jogo e9/9 da infraestrutura passaram. QA navegador: colisão real, levantar/correr/cruzar, desbloqueio, recarga/equipar, pedalar/frear, controle móvel, campeonato e confirmação em outra sessão da conta. WebSockets de conta/convidado verificaram veículo e repetição de pacotes sem duplicar pedaladas. Cliente da skill passou, capturas/estados/arte conferidos sem erros. Documentação em sources/asfalto-bruto/docs/bicicleta-secreta.md.
- Build/export aprovados. Preparando ativação somente na VPS com guarda de corridas. Vercel permanece desativado; protótipo4390 e dados reais não foram alterados pelo QA.

- Publicado06b101c na release20260912T163127Z-06b101c; Asfalto/Catálogo/Caddy ativos. Beta1.3.0/protocolo15 nos dois domínios, JS index-5lwK7VRl.js e CSS index-CO4fTM_r.css idênticos ao build. QA HTTPS passou por colisão real, chegada a pé, desbloqueio/mensagem, recarga/equipar, pedaladas versus tecla mantida e celular. Capturas conferidas, sem erros JavaScript; somente saves convidados isolados, ?test sem visitas/contas/rankings artificiais. Nenhum status/deployment Vercel no commit. QA4395 encerrado; protótipo4390 preservado. Entregue; registro posterior não requer redeploy.

## 2026-09-12 — Beta1.4.0: conquistas e Magrela a60 km/h
-25 conquistas no cartão ao lado do campeonato.13 públicas/12 secretas, nome/descrição/progresso ocultos até conquistar, filtros e contador. Desbloqueios mostrados no resultado; somente Na raça mantém o prêmio da Magrela, sem inventar novos prêmios. Menu sem rolagem nos12 tamanhos de320x568 a1920x1080, incluindo paisagem.
- Simulação registra derrubadas por autor/alvo, carros diferentes realmente ultrapassados no salto, obstáculos de salto existentes da Terra, curva completa válida com contato real da joelheira, posições na metade e últimos100m, e dano. Liquidação distingue feito de vitória, mantém feitos em derrotas, zera sequência em derrota/abandono/reinício. Convidado salva localmente; conta verifica replay/sala e grava com recibos idempotentes.
- Legado reconhece Magrela, registros de pista/clima e histórico de campeonato. Ranking oficial migra uma vez por conta, com achievement_imports preservado no reset. Migração usa cópia do save e foi testada numa conta existente, sem alterar saldo/equipamentos. Não se inventam saltos, quedas, sequência ou ausência de dano do passado.
- Bicicleta60 km/h de fábrica, transmissão até67,8km/h preservando ganho percentual antigo. Prazo multiplayer maior somente para bicicleta, proporcional à pista; motos mantêm360s. Cinco pistas secas/molhadas completadas com pedaladas. Protocolo16/ranking3.
-213 testes amplos,43 testes finais direcionados e9 VPS passaram. Typecheck/build/export aprovados. QA de navegador cobriu painel/segredos/filtros, salto real + derrota, chegada a pé, recarga, legado, celular a60km/h e conta em outro aparelho, sem erros JS/console. Skill conferida com513 ticks/16,67m/s. Documentação em sources/asfalto-bruto/docs/conquistas.md. Preparando publicação somente VPS com guarda de corridas; protótipo4390 preservado.

- Publicado código 853400b somente na VPS, release 20260912T171128Z-853400b. Asfalto/Catálogo/Caddy ativos. Ambos os domínios confirmam Beta1.4.0/protocolo16 e assets index-DhTcciEZ.js/index-BQ3uL92L.css idênticos ao build local.
- QA HTTPS passou: 25 cartões/12 secretos, filtros, colisão real e chegada a pé, revelação de Na raça, recarga/equipar, pedaladas versus tecla mantida e celular a60km/h. Capturas públicas do painel, conquista e corrida conferidas; sem erros JavaScript. Cliente público da skill passou,513 ticks/16,67m/s. Somente convidados isolados em ?test; sem contas/rankings/visitas artificiais. Nenhum status/deployment Vercel no commit. QA4397 encerrado; protótipo4390 preservado. Entrega concluída; registro posterior não exige redeploy.


## 2026-09-12 — Beta1.4.1: guard rail contínuo até a borda da tela
- Reproduzido na Costa do Sol: o descarte pela base do poste removia toda a barra de8m enquanto parte dela ainda estava no enquadramento. Barras agora são recortadas no plano da câmera e na tela/relevo independentemente dos postes; postes consideram sua altura completa e são recortados pelo relevo. Brilho da barra acompanha a perspectiva. Física, sons, contas, protocolo16 e ranking3 preservados.
- Comparações antes/depois em12 quadros e capturas adicionais da Costa, Serra e Porto, dia/entardecer/noite/chuva, desktop e celular em pé/deitado. QA isolado espera o evento de resize antes de desenhar para não capturar canvas limpo. Imagens conferidas: proteção contínua até sair do quadro.
-11 testes direcionados de barreira/câmera e9 VPS passaram. Navegador passou colisão, redução de velocidade, saída do contato, dois lados da Serra, obras, celular, dois humanos/seis bots e reconexão, sem erros JS/console. Cliente da skill passou após repetir a execução interrompida pelo recarregamento do export:525 ticks,51,78m/s, imagem/estado conferidos sem erros. Typecheck/build/export aprovados. Preparando publicação somente na VPS com guarda de corridas; protótipo4390 não alterado.
