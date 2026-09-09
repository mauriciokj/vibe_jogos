# Asfalto Bruto

Jogo original de corrida e combate de motos inspirado nos arcades dos anos 1990. Modo individual e multiplayer opcional para navegador, feito com **TypeScript, Vite e Canvas 2D**, com estrada em perspectiva 2.5D.

## Jogar localmente

Requer Node.js 22.12 ou posterior.

```sh
npm install
npm run dev
```

Abra **http://127.0.0.1:4317/** e clique em **Jogar sozinho**. O tutorial aparece antes da primeira largada. A porta é fixa para evitar abrir outro aplicativo local por engano.

Para gerar os arquivos estáticos:

```sh
npm run build
npm run preview
```

O terminal informa a URL da prévia. A pasta `dist/` contém a versão distribuível. Sirva essa pasta por HTTP; abrir `index.html` diretamente pelo Finder não carrega os módulos corretamente.

## Controles

| Ação | Tecla |
| --- | --- |
| Acelerar | W / ↑ |
| Frear | S / ↓ |
| Pilotar | A e D / ← e → |
| Socar / tomar o bastão de um rival | J |
| Chutar e empurrar o rival | K |
| Usar o equipamento de combate | L |
| Empinar / preparar salto automático | Dois toques rápidos em W / ↑ |
| Apoiar o joelho (com joelheira, exceto choppers) | Dois toques rápidos em A/← ou D/→ |
| Ativar nitro comprado | N |
| Buzinar / provocar | B / Q |
| Pausar / continuar | Esc |
| Alternar tela cheia | F |
| Ligar / desligar som | M |

O rival ao alcance recebe uma marca verde. Um “!” indica um ataque em preparação. Os rivais têm uma preparação extra de 250 ms para permitir evasão. Ataques só atingem uma vez durante a janela de acerto e respeitam distância lateral e longitudinal.

O som começa depois de uma interação. Em telas estreitas, há controles por toque. O projeto foi priorizado para desktop; o toque é uma alternativa e ainda merece testes em dispositivos físicos.

Joelheira: dois toques rápidos em A/← ou D/→. Nitro: **N**. Buzina: **B**. Provocação: **Q**. Detalhes de preços, estoque e controles em [Equipamentos e controles](docs/equipamentos-controles.md).

## O que está implementado

- Um jogador e sete rivais com perfis agressivo, cauteloso e veloz, usando o mesmo sistema de comandos da simulação.
- Rivais especialistas usam joelheiras nas curvas secas, com a mesma manobra de até quatro segundos do jogador. Choppers e polícia seguem sem apoio de joelho; na chuva, a IA freia e contorna em pé. O ajuste de ritmo preserva os atributos, equipamentos e compras do jogador.
- Curvas alternadas com aviso de direção, distância e velocidade de referência. Excesso de velocidade reduz a aderência; frear antes da entrada e acelerar na saída permite ganhar terreno sem depender de acidentes.
- Mapa de proximidade com 300m para cada lado, pilotos por cor e distâncias ao da frente e de trás. Retrovisor mostra motos e trânsito nos últimos 200m, com indicação de aproximação.
- Cinco estradas com curvas, elevações e cenários próprios: **Costa do Sol** (8,4 km), **Serra da Fumaça** (9,2 km), **Vale Vermelho** (10,2 km), **Porto Ferrugem** (7,8 km) e **Terra Brava** (7,2 km).
- **Dia, Entardecer, Noite e Chuva** nas cinco estradas: 20 combinações. Cada combinação aparece como uma pista própria na seleção (por exemplo, Costa do Sol · Dia), em cartões com navegação lateral. A criação de salas usa a mesma lista combinada. A escolha completa muda o cenário e fica salva; na chuva, a aderência equivale a 82% da dirigibilidade e a frenagem a 88% da força original. Dia/noite mantêm a física seca. Os avisos de curva e os bots consideram o piso molhado.
- Aparição rara de uma **sereia no mar da Costa**, com poses próprias por condição: cauda entre as ondas na chuva, brilho discreto à noite e pedra no entardecer. É apenas cenário, sem colisão, prêmio, dano ou aviso. Cada corrida tem 33% de chance, um local sorteado e uma janela de 8 segundos, iniciada quando o primeiro humano chega a 180m. No online, todos compartilham a mesma aparição.
- **Porto Ferrugem:** acesso amplo, armazéns, chicanes nas obras, curvas de serviço e avenida de guindastes. Caminhões lentos e na contramão, cones que tiram 10% da velocidade e 4 de resistência sem queda imediata, blocos de concreto com colisão forte. Obras ocupam uma faixa lateral, com aviso 220m antes e placas. Navios, contêineres, guindastes, luzes noturnas e reflexos na chuva compõem o cenário. Um passageiro pendurado em um caminhão da contramão pode aparecer: chance de 33%, janela de 8s compartilhada, apenas visual; o caminhão mantém sua colisão normal.
- Recordes por estrada e condição. Saves v1 continuam válidos; os recordes anteriores pertencem ao Entardecer.
- Superar um recorde pessoal de tempo no individual paga um bônus de 30% do prêmio anunciado da pista, somado à recompensa da posição. A primeira chegada estabelece o recorde; empates e corridas não concluídas não dão bônus. O resultado mostra o extra separado e o total recebido. Dinheiro e recorde usam o mesmo salvamento, inclusive na conta Google.
- Trânsito nos dois sentidos, carros e vans nas faixas, óleo, barreiras, ultrapassagens e colisões.
- Socos, chutes e bastão básico que pode ser tomado. Garagem de combate com garrafa ($650 / 24 de dano), bastão de beisebol ($1.500 / 38) e corrente ($2.400 / 32), com alcance e cadência próprios. Compras são permanentes e não podem ser tomadas.
- Empinada com dois toques no acelerador, acima de 72 km/h: três ativações por corrida, até 2,4s por ativação e salto automático sobre um carro alinhado na contramão. Vans e caminhões não são elegíveis. O contador é preservado na reconexão. Sem imunidade geral; quedas e polícia continuam valendo.
- Resistência do piloto e integridade da moto separadas. Piloto sem resistência cai; moto sem integridade encerra a corrida.
- Procura policial alimentada pela velocidade e pelos golpes. Depois de 1,3 km e 48 pontos de procura, um policial inicia a perseguição. Cair com um policial ativo a até **30 metros** causa **prisão imediata e derrota**, inclusive se ele se aproximar enquanto o piloto ainda estiver no chão. Também há captura após 3 segundos ao lado do policial, abaixo de 8 m/s (aproximadamente 29 km/h).
- Largada, classificação por distância/tempo de chegada, resultados, recompensas, repetição da corrida, pausa automática ao sair da janela.
- Garagem com **sete modelos**: Ferro 500 (street), Veneno 750 (esportiva), Brutal 1000 (muscle), Falcão 450 (supermoto), Estradeira 900 (cruiser), Lobo 1200 (chopper) e Agulha 600 (café racer). Cada uma tem silhueta, aceleração, aderência nas curvas e resistência próprias; três níveis de motor, resistência e dirigibilidade, além de reparos. A Falcão é a mais ágil; a Lobo exige frear antes, mas suporta mais danos.
- Preços das motos: Ferro inicial; Falcão **$10.000**, Estradeira **$18.000**, Veneno **$30.000**, Lobo **$45.000**, Agulha **$65.000** e Brutal **$100.000**. Propriedade, melhorias e saldo anteriores são preservados; a mudança vale para novas compras.
- Porto é liberado ao terminar Vale Vermelho entre os cinco primeiros. Um recorde antigo nessa posição, em qualquer condição, já libera a nova pista ao carregar o save.
- Próxima estrada liberada com uma colocação entre os cinco primeiros. Todas as colocações recebem dinheiro; derrotas recebem uma pequena ajuda. A Ferro 500 recebe reparo gratuito até 55% depois de cada corrida, evitando bloqueio econômico.
- Joelheiras permanentes em cinco cores, preços e bônus: duplo toque para o mesmo lado ativa o apoio de joelho por até 4s acima de 72 km/h. Choppers não fazem a manobra; na chuva, a queda acontece somente após mais de 2 segundos contínuos com o joelho apoiado. Tirar o joelho zera o contador; pausar congela o tempo, e reconectar preserva o estado da corrida. O bônus atua durante o apoio em curva e respeita a agilidade da moto.
- Nitro a $2.500 por carga: +10% de aceleração e velocidade máxima durante 5s, com consumo permanente. Estoque por moto, limitado a 2, 3 ou 5 cargas. A Brutal 1000 é a única com capacidade 5.
- B buzina e Q sorteia uma de dez provocações aprovadas, exibida em balão. Rivais próximos também provocam ocasionalmente, sem afetar o RNG da física. No celular, dois analógicos controlam direção e aceleração/frenagem; o duplo movimento da direção ativa o joelho. Botões de combate e nitro mantidos; sem botões B/Q.
- Salvamento local de créditos, motos, melhorias, joelheiras, nitro, condições, pistas, recordes e preferência de áudio. A garagem permite apagar o progresso com uma confirmação.
- Sprites e cenários originais, asfalto com textura, defensas, refletores, placas de curva, vegetação e relevo detalhados. Faixas curtas e detalhes no acostamento reforçam a passagem do cenário.
- Câmera de perseguição mais baixa e próxima do asfalto, com campo de visão progressivo e tamanho da moto estável ao acelerar. Faixas de 3 metros, refletores mais próximos e vegetação junto ao acostamento reforçam a sensação de velocidade, preservando a velocidade real e a física da corrida.
- Rastros no asfalto e no acostamento acompanham o deslocamento real; vento nas bordas, pneus animados e suspensão completam o movimento. A preferência do sistema por movimento reduzido desativa as variações da câmera e os efeitos extras. A pausa congela os rastros junto com a corrida.
- Áudio sintetizado com motor e vento proporcionais à velocidade e timbre mais grave nas customs. Fontes distribuídas localmente, sem chamadas externas durante o jogo.
- Motos recalibradas: cerca de 12% mais velocidade máxima e 25% mais aceleração que a primeira versão. A Ferro 500 alcança aproximadamente 230 km/h sem melhorias; a Veneno 750, 263 km/h; a Brutal 1000, 281 km/h. Danos e acostamento reduzem esses valores.

## Estrutura e multiplayer opcional

| Arquivo | Responsabilidade |
| --- | --- |
| `src/game/simulation.ts` | Simulação em passos de 1/60 s, entradas, IA, colisões, combate, eventos e snapshots |
| `src/game/types.ts` | Estado serializável e tipos de comandos, pilotos e progressão |
| `src/game/conditions.ts` / `mermaid.ts` | Condições, paletas, aderência e aparição decorativa independente da física |
| `src/game/content.ts` | Parâmetros das motos, estradas, curvas e elevações |
| `src/game/awareness.ts` / `instruments.ts` | Distâncias por identidade local, mapa e retrovisor com resolução limitada |
| `src/game/renderer.ts` | Projeção, desenho, profundidade, oclusão nas elevações e efeitos |
| `src/game/sprites.ts` | Motos, pilotos e carros rasterizados, incluindo animação dos pneus |
| `src/game/scenery.ts` | Vegetação, rochas e construções originais em cache, com aleatoriedade apenas visual |
| `src/game/audio.ts` | Motor e efeitos sonoros, sem influência na simulação |
| `src/game/save.ts` | Progressão, compras, reparos e persistência no navegador |
| `src/game/bikes.ts` / `src/game/equipment.ts` / `src/game/banter.ts` | Modelos, equipamentos, técnica de curva e provocações |
| `src/equipment-ui.ts` / `src/touch.css` | Loja e analógicos móveis |
| `src/game/routes.ts` / `src/menu.css` | Combinações de pista/condição e menu em fluxo responsivo, com rolagem em janelas baixas |
| `src/main.ts` | Entradas, ciclo de execução, HUD, menus e integração |
| `src/multiplayer/` | Protocolo, conexão, previsão de movimento e estilos das salas |
| `server/` | Regras de salas, simulação autoritativa, conexões e armazenamento em memória/Redis |
| `api/asfalto.ts` | Endpoint WebSocket para Vercel |
| `scripts/export-jogos.mjs` | Build e integração reproduzível no catálogo Vibe Jogos |

A simulação não acessa DOM, Canvas, áudio ou relógio real. Usa IDs estáveis, entradas por jogador e um gerador pseudoaleatório com seed e estado serializado. `snapshot()` e `restoreSnapshot()` reproduzem uma corrida; testes verificam resultados idênticos após restaurar e continuar com os mesmos comandos.

**Multiplayer é opcional e já está implementado.** O modo individual continua local, com a mesma garagem. Antes de criar ou entrar numa sala, cada pessoa escolhe livremente um dos sete modelos com atributos de fábrica, sem as melhorias de motor, resistência e dirigibilidade da campanha. A joelheira equipada e as cargas de nitro compradas acompanham o jogador; cargas usadas são descontadas da garagem. Os bots também pilotam modelos variados. O botão Multiplayer abre salas para 2–8 pessoas, com janela de 60 segundos por convite ou **120 segundos ao marcar Sala pública**, e largada em até 5 segundos quando todos os presentes estão prontos. Em **Encontrar partidas públicas**, basta escolher uma sala aberta e tocar em Entrar, sem receber um código. Quem cria a sala pode marcar **Completar com bots**: vagas livres recebem pilotos identificados como CPU na largada, até completar oito. Continuam necessárias duas pessoas reais. O servidor controla a corrida; cada piloto tem sua própria câmera, prisão e resultado. Veja [MULTIPLAYER.md](MULTIPLAYER.md) para as regras completas, reconexão, testes e publicação no catálogo Vibe Jogos.

Para usar o modo online localmente, execute também `npm run dev:server` em outro terminal. A publicação atual usa uma VPS com um único processo Node e `ASFALTO_STORE=memory`, sem Redis. O catálogo está em `flowofdevelopment.com/catalogo/`; a infraestrutura e o deploy ficam em `infra/vps/` no repositório `mauriciokj/vibe_jogos`, branch `codex/vps-centralizacao`. A configuração Vercel anterior permanece disponível e exige Redis entre instâncias.

## Verificação

```sh
npm test
# Em outro terminal, deixe npm run dev em execução:
npx playwright install chromium
npm run test:browser
```

- **73 testes de simulação, salas e conexões:** pilotagem, frenagem, limites, alcance, roubo de arma, evasão, quedas, colisões, óleo, barreiras, classificação, polícia, economia, equipamentos, duplo toque, nitro, provocações, snapshots e consistência a 30/60/144 FPS.
- Corridas completas nas três pistas, em piso seco e na chuva, com comandos dentro dos limites de controle do jogador.
- Testes de navegador: teclado, tutorial, pausa, reinício, todos os golpes, queda/retorno, captura, corrida completa, resultados, desbloqueio, persistência, reparos, compras, todas as melhorias, seleção de moto, reset, áudio, tela cheia e toque.
- `npm run test:online` verifica dois navegadores e seis conexões adicionais com 200ms de atraso de ida e volta. Inclui largada, combate, reconexão, prisão individual e retorno ao modo individual.
- `npm run test:porto` verifica preços, desbloqueio por recorde anterior, Porto nas quatro condições, obras e passageiro, celular, dois humanos + seis bots, combate e reconexão. Os testes de simulação também percorrem Porto com as sete motos no seco e na chuva. Artefatos em `output/porto/`.
- `npm run test:conditions` verifica as 20 combinações visuais, seleção persistente, saves anteriores, pausa/reinício, cartões, navegação lateral e menu em sete tamanhos, sala com duas pessoas e seis bots, condição e aparição compartilhadas, golpes na chuva e reconexão. Artefatos em `output/conditions/`.
- `npm run test:equipment` verifica compras, cinco joelheiras, nitro 2/3/5, duplo toque, chopper, queda na chuva, pausas/reinícios, buzina, balões, dois toques simultâneos reais no Chromium, ações online e consumo preservado na reconexão.
- `npm run test:wet-knee` verifica em dois navegadores e seis bots a tolerância na chuva, reset ao levantar o joelho, queda confirmada pelo servidor e reconexão preservando o contador.
- `npm run test:bikes` verifica os sete modelos na garagem e na corrida, compras, melhorias, preservação do save, seleção online móvel, atributos de fábrica e reconexão entre modelos diferentes.
- `npm run test:tactics` verifica a opção de bots, corrida com duas pessoas e seis CPUs, frenagem compartilhada, reconexão, resultados, mapa/retrovisor no desktop e celular, além da cadência de uma corrida com os instrumentos.
- `npm run test:motion` verifica estabilidade de movimento com atraso variável de rede e armazenamento, direção e golpes com toques de 5ms em alta velocidade.
- `npm run test:network` mede a cadência e a confirmação dos comandos na prévia publicada. Aceita `ASFALTO_BENCH_URL` para outro servidor e `ASFALTO_BENCH_PLAYERS=8` para medir uma sala cheia. `ASFALTO_BENCH_BOTS=1` completa as vagas com CPUs.
- `ASFALTO_TEST_REDIS_URL=redis://127.0.0.1:6398 npm run test:redis` verifica Redis real, concorrência e reconexão entre duas instâncias.
- Imagens dos estados testados e relatórios são gravados em `output/browser/` e `output/online/`. O teste de recursos externos confirma que o jogo só solicita arquivos da própria origem.
- A skill de desenvolvimento de jogos também foi usada para executar o cliente Playwright de ações curtas e inspecionar seus screenshots/estados.

`window.render_game_to_text()` expõe um resumo legível do estado. `window.advanceTime(ms)` ativa o avanço manual para automação. Apenas a URL com `?test` oferece `window.__game` para fixtures, snapshots e comandos de teste; `?test&race` começa direto na corrida. Jogue na URL sem esses parâmetros para usar o relógio normal.

## Limites desta versão

É uma primeira versão funcional, ainda aberta a ajustes de dificuldade e sensação de controle após testes humanos. O cenário é 2.5D, a física é arcade e o som é sintetizado. Os sete modelos usam arte original em cache, com vistas próprias na garagem, na corrida e no retrovisor. A meta é 60 FPS, mas o resultado depende do dispositivo e do navegador. A validação automatizada usou Chromium desktop e viewport móvel, não uma matriz de celulares físicos.

## Fontes e licenças

Barlow e Barlow Condensed, de Jeremy Tribby, são distribuídas sob SIL Open Font License 1.1. As licenças estão em `public/fonts/`. A arte de pilotos, motos, veículos, paisagens e ícone foi criada neste projeto, sem assets da franquia de referência.

`npm run test:stunts` valida compra e persistência de combate, poses dos três itens, empinada/salto/aterrissagem, três usos, colisão com caminhão de teste, controles nativos no celular e sala com dois humanos + seis bots, dano de corrente à distância e reconexão.

## Contador de visitantes

O menu mostra “X pessoas já tentaram a sorte”, uma estimativa de navegadores únicos desde a ativação do contador. A consulta roda em segundo plano e não interfere nas corridas. Se indisponível, o menu continua funcionando sem mostrar um total fictício.

Na VPS, `POST /api/visitors?game=asfalto-bruto` registra a visita com cookie anônimo assinado, HttpOnly, SameSite=Lax e Secure em HTTPS; `GET` apenas consulta `{visitors,since,metric}`. O cookie compartilhado entre os domínios flowofdevelopment.com e asfaltobruto.flowofdevelopment.com evita duplicação ao alternar entre eles. Atualizações de página, novas abas e reinícios do servidor preservam a contagem. Outro navegador/dispositivo, modo anônimo ou limpeza/expiração de cookies podem contar novamente. Sem login, nomes, IPs ou histórico de navegação no banco do contador. A proteção de abuso usa IP apenas em memória, em janelas de um minuto, sem gravá-lo no banco.

Os totais e hashes anônimos ficam no SQLite persistente do catálogo, incluído no backup existente. Não é possível recuperar visitantes anteriores à ativação por este contador. O cookie dura até 400 dias, renovados a cada visita, sujeito às políticas do navegador. O modo `?test` e navegadores sem cookies fazem somente leitura para não inflar o número.

Para desenvolvimento, inicie o catálogo com um banco temporário e defina `VIBE_CATALOG_URL` ao iniciar o Vite (padrão http://127.0.0.1:4320). `npm run test:visitors` inicia uma base isolada e verifica contagem, recarga/abas, celular e corrida. Fora do checkout padrão, informe `VIBE_CATALOG_DIR` apontando para o repositório Jogos. Testes de persistência, concorrência e restrições HTTP: `npm run test:vps` no catálogo.

### Áudio do salto

Saltar sobre um carro dispara uma pancada metálica curta e eleva o giro e o brilho do motor enquanto a roda traseira está no ar. A aterrissagem restaura o timbre normal, preservando o som próprio de cada estilo de moto. A mudança é sonora, sem alterar a potência, a física ou o protocolo v9. Pausa/silenciamento são respeitados; o mesmo salto não repete o impacto ao receber snapshots nem ao retomar uma pausa ou uma corrida online em andamento.

`npm run test:jump-audio` verifica os nós Web Audio reais no Chromium, giro no chão/no ar/após aterrissar, impacto único, pausa, mute, snapshots repetidos, caminhão e reinício. `AUDIO_CHECK_URL` permite usar uma instalação publicada, sempre em modo `?test` de leitura para o contador de visitas.

### Guard-rails com colisão

As proteções da Costa do Sol e Porto Ferrugem (esquerda) e Serra da Fumaça (ambos os lados) seguram a moto e reduzem a velocidade enquanto ela força a passagem. O contato com o guard-rail não tira vida/integridade nem provoca queda; basta virar para dentro da pista para sair do contato e acelerar. As laterais sem proteção continuam abertas e os obstáculos das obras mantêm suas próprias regras de colisão.

A geometria compartilhada mantém desenho, colisão, previsão e pilotos remotos alinhados; empurrões e nitro também respeitam a barreira. A regra se aplica a todos os pilotos e climas. Protocolo multiplayer v10, sem mudanças no save v1. `npm run test:guardrails` confere colisão, liberação, obras, celular e uma sala com dois humanos/seis bots e reconexão.


### Áudio das proteções laterais

O primeiro contato com guard-rail toca uma pancada metálica curta; o contato em movimento mantém uma raspagem que acompanha a velocidade. O som cessa ao afastar, parar, cair ou pausar. Pequenas correções online não repetem a pancada. Os loops são reaproveitados e respeitam o áudio silenciado. Física e protocolo v10 preservados.

Verificação Web Audio e corrida com dois clientes: `npm run test:guardrail-audio`. Para a versão publicada, defina `GUARDRAIL_AUDIO_URL` com a URL do jogo; o teste usa `?test` para não registrar visitantes artificiais.


### Capacetes e cores

Garagem → Capacetes: Integral incluído, Retrô por 1.500 créditos, Cross por 3.000 e Racing por 5.000. As compras são permanentes; equipar novamente é gratuito. Oito cores (branco, preto, vermelho, laranja, amarelo, verde, azul e roxo) podem ser trocadas sem custo, com prévias de frente e costas.

Os capacetes são cosméticos e compatíveis com todas as motos. Aparecem no piloto, nos adversários e no retrovisor, incluindo manobras e corridas online. Modelo/cor e propriedade ficam no save v1 do navegador, preservando os equipamentos já comprados. Saves anteriores recebem o Integral branco; IDs inválidos e modelos não comprados voltam ao básico. Não há sincronização de garagem entre navegadores.

Os campos opcionais de personalização no loadout/lobby/mundo são normalizados pelo servidor e preservados na reconexão, compatíveis com o protocolo v10. Bots usam variações determinísticas sem interferir na física ou no RNG da pista. O cache dos sprites de pilotos tem limite de 512 variantes.

`npm run test:helmets` verifica compras, pintura gratuita, persistência, layout móvel, chopper/retrovisor e dois humanos com seis bots. `HELMET_CHECK_URL` aponta o teste para uma instalação publicada usando `?test`, sem inflar visitantes.


## Terra Brava

Estrada rural de 7,2 km, com uma faixa por sentido, doze curvas, morros, cercas e fazendas. Disponível de dia, entardecer, noite e chuva; são vinte opções de pista no total. Na campanha, um top 5 no Porto Ferrugem libera suas quatro versões, inclusive com recorde salvo antes da atualização. O multiplayer oferece a pista sem exigir progresso na campanha.

- Barrancos em seis trechos alternados: impedem atravessar e reduzem velocidade, sem causar queda/dano por si. As entradas se aproximam gradualmente; espaços entre barrancos permanecem abertos. Som de terra/pedras raspando, distinto dos guard-rails de metal.
- Tratores lentos e carros em ambos os sentidos. Tratores têm silhueta e colisão próprias, aparecem no retrovisor e não podem ser saltados.
- Terra com aderência e arrasto moderados; subidas/descidas influenciam a aceleração. Na chuva, lama e poças; no seco, cascalho e poeira discreta. As sete motos continuam utilizáveis.
- Saci decorativo; Boitatá à noite. Aparição de 33% por corrida, oito segundos, sem efeito na física. Sorteio e instante compartilhados online.
- Largada em duas colunas para até oito corredores, mantendo dois humanos como mínimo, sala de 60 segundos e cinco segundos quando todos estiverem prontos.

Geometria, trânsito, piso e barrancos compartilhados pela simulação, previsão, desenho e retrovisor. Protocolo atual **v11**: recarregar as páginas antes de criar nova sala. Saves v1 e equipamentos comprados preservados.

`npm run test:rural` verifica as quatro condições, desbloqueio, computador/celular, barrancos/áudio, tratores, folclore, dois humanos + seis bots, combate contra barranco e reconexão. `RURAL_CHECK_URL` permite repetir a validação pública em `?test`. Testes de simulação incluem corridas completas com sete motos no seco/chuva e equivalência da previsão. Artefatos em `output/terra/`.


## Ajuste de dificuldade — rivais nas curvas

Na campanha, Cobra, Dante e Faísca usam joelheiras: verde na Costa, azul em Serra/Porto/Terra e roxa para os velozes no Vale. O apoio é visível e passa pelo mesmo comando e física do jogador. A IA evita usá-lo na chuva, no acostamento, durante acrobacias e ao corrigir para o lado oposto da curva. No segundo ajuste, os rivais individuais passaram a usar 98%, 99% e 100% da velocidade máxima de fábrica conforme o nível da pista (mais 1–3,2% em relação à versão anterior). O ritmo de curva dos três perfis subiu cerca de 1%; a polícia mantém o ritmo anterior. Não há compensação automática de distância nem alteração nas compras ou atributos humanos. As CPUs opcionais do multiplayer também usam a técnica, mantendo as velocidades de fábrica já existentes. Protocolo v11 e save v1 preservados.

`npm run test:difficulty` verifica a manobra visível, chuva, celular, pausa, equipamentos, dois humanos + seis bots e reconexão. `DIFFICULTY_CHECK_URL` permite testar uma publicação em `?test`. `npm run test:balance` compara 30 corridas completas controladas por uma direção automatizada: cinco pistas, três seeds e Ferro 500 com/sem joelheira dourada. Para carregar outra versão da simulação, use `BALANCE_SOURCE_ROOT`; o primeiro argumento é o caminho do relatório JSON.

Na comparação deste segundo ajuste, a Ferro com joelheira dourada passou de colocação média 2,4 para 2,87, com top 5 nas 15 corridas em ambas as versões; vitórias passaram de uma para zero. Sem joelheira, a média passou de 5,33 para 5,8 (nove para cinco top 5). Todas as 30 corridas foram concluídas em ambas as versões. São amostras de um piloto automatizado no seco, sem golpes, não uma previsão dos resultados de jogadores. Artefatos locais em `output/difficulty/`.
