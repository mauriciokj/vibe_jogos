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
| Usar o bastão equipado | L |
| Pausar / continuar | Esc |
| Alternar tela cheia | F |
| Ligar / desligar som | M |

O rival ao alcance recebe uma marca verde. Um “!” indica um ataque em preparação. Os rivais têm uma preparação extra de 250 ms para permitir evasão. Ataques só atingem uma vez durante a janela de acerto e respeitam distância lateral e longitudinal.

O som começa depois de uma interação. Em telas estreitas, há controles por toque. O projeto foi priorizado para desktop; o toque é uma alternativa e ainda merece testes em dispositivos físicos.

## O que está implementado

- Um jogador e sete rivais com perfis agressivo, cauteloso e veloz, usando o mesmo sistema de comandos da simulação.
- Três estradas com curvas, elevações e cenários próprios: **Costa do Sol** (8,4 km), **Serra da Fumaça** (9,2 km) e **Vale Vermelho** (10,2 km).
- Trânsito nos dois sentidos, carros e vans nas faixas, óleo, barreiras, ultrapassagens e colisões.
- Socos, chutes, bastão, roubo de arma, quedas, recuperação e um breve período de proteção ao voltar à pista.
- Resistência do piloto e integridade da moto separadas. Piloto sem resistência cai; moto sem integridade encerra a corrida.
- Procura policial alimentada pela velocidade e pelos golpes. Depois de 1,3 km e 48 pontos de procura, um policial inicia a perseguição. Cair com um policial ativo a até **30 metros** causa **prisão imediata e derrota**, inclusive se ele se aproximar enquanto o piloto ainda estiver no chão. Também há captura após 3 segundos ao lado do policial, abaixo de 8 m/s (aproximadamente 29 km/h).
- Largada, classificação por distância/tempo de chegada, resultados, recompensas, repetição da corrida, pausa automática ao sair da janela.
- Garagem com **Ferro 500**, **Veneno 750** e **Brutal 1000**, três níveis de motor, resistência e dirigibilidade, além de reparos.
- Próxima estrada liberada com uma colocação entre os cinco primeiros. Todas as colocações recebem dinheiro; derrotas recebem uma pequena ajuda. A Ferro 500 recebe reparo gratuito até 55% depois de cada corrida, evitando bloqueio econômico.
- Salvamento local de créditos, motos, melhorias, condições, pistas, recordes e preferência de áudio. A garagem permite apagar o progresso com uma confirmação.
- Sprites e cenários originais, asfalto com textura, defensas, refletores, placas de curva, vegetação e relevo detalhados. Faixas curtas e detalhes no acostamento reforçam a passagem do cenário.
- Câmera de perseguição mais baixa e próxima do asfalto, com campo de visão progressivo e tamanho da moto estável ao acelerar. Faixas de 3 metros, refletores mais próximos e vegetação junto ao acostamento reforçam a sensação de velocidade, preservando a velocidade real e a física da corrida.
- Rastros no asfalto e no acostamento acompanham o deslocamento real; vento nas bordas, pneus animados e suspensão completam o movimento. A preferência do sistema por movimento reduzido desativa as variações da câmera e os efeitos extras. A pausa congela os rastros junto com a corrida.
- Áudio sintetizado com motor e vento proporcionais à velocidade. Fontes distribuídas localmente, sem chamadas externas durante o jogo.
- Motos recalibradas: cerca de 12% mais velocidade máxima e 25% mais aceleração que a primeira versão. A Ferro 500 alcança aproximadamente 230 km/h sem melhorias; a Veneno 750, 263 km/h; a Brutal 1000, 281 km/h. Danos e acostamento reduzem esses valores.

## Estrutura e multiplayer opcional

| Arquivo | Responsabilidade |
| --- | --- |
| `src/game/simulation.ts` | Simulação em passos de 1/60 s, entradas, IA, colisões, combate, eventos e snapshots |
| `src/game/types.ts` | Estado serializável e tipos de comandos, pilotos e progressão |
| `src/game/content.ts` | Parâmetros das motos, estradas, curvas e elevações |
| `src/game/renderer.ts` | Projeção, desenho, profundidade, oclusão nas elevações e efeitos |
| `src/game/sprites.ts` | Motos, pilotos e carros rasterizados, incluindo animação dos pneus |
| `src/game/scenery.ts` | Vegetação, rochas e construções originais em cache, com aleatoriedade apenas visual |
| `src/game/audio.ts` | Motor e efeitos sonoros, sem influência na simulação |
| `src/game/save.ts` | Progressão, compras, reparos e persistência no navegador |
| `src/main.ts` | Entradas, ciclo de execução, HUD, menus e integração |
| `src/multiplayer/` | Protocolo, conexão, previsão de movimento e estilos das salas |
| `server/` | Regras de salas, simulação autoritativa, conexões e armazenamento Redis |
| `api/asfalto.ts` | Endpoint WebSocket para Vercel |
| `scripts/export-jogos.mjs` | Build e integração reproduzível no catálogo Vibe Jogos |

A simulação não acessa DOM, Canvas, áudio ou relógio real. Usa IDs estáveis, entradas por jogador e um gerador pseudoaleatório com seed e estado serializado. `snapshot()` e `restoreSnapshot()` reproduzem uma corrida; testes verificam resultados idênticos após restaurar e continuar com os mesmos comandos.

**Multiplayer é opcional e já está implementado.** O modo individual continua local, com a mesma garagem. O botão Multiplayer abre salas para 2–8 pessoas, com janela de 60 segundos e largada em até 5 segundos quando todos os presentes estão prontos. O servidor controla a corrida; cada piloto tem sua própria câmera, prisão e resultado. Veja [MULTIPLAYER.md](MULTIPLAYER.md) para as regras completas, reconexão, testes e publicação no catálogo Vibe Jogos.

Para usar o modo online localmente, execute também `npm run dev:server` em outro terminal. O Redis é obrigatório no Vercel para compartilhar salas entre instâncias; em desenvolvimento há armazenamento em memória.

## Verificação

```sh
npm test
# Em outro terminal, deixe npm run dev em execução:
npx playwright install chromium
npm run test:browser
```

- **31 testes de simulação, salas e conexões:** pilotagem, frenagem, limites, alcance, roubo de arma, evasão, quedas, colisões, óleo, barreiras, classificação, polícia, economia, snapshots e consistência a 30/60/144 FPS.
- Corridas completas nas três pistas, com comandos dentro dos limites de controle do jogador.
- Testes de navegador: teclado, tutorial, pausa, reinício, todos os golpes, queda/retorno, captura, corrida completa, resultados, desbloqueio, persistência, reparos, compras, todas as melhorias, seleção de moto, reset, áudio, tela cheia e toque.
- `npm run test:online` verifica dois navegadores e seis conexões adicionais com 200ms de atraso de ida e volta. Inclui largada, combate, reconexão, prisão individual e retorno ao modo individual.
- `npm run test:motion` verifica estabilidade de movimento com atraso variável de rede e armazenamento, direção e golpes com toques de 5ms em alta velocidade.
- `ASFALTO_TEST_REDIS_URL=redis://127.0.0.1:6398 npm run test:redis` verifica Redis real, concorrência e reconexão entre duas instâncias.
- Imagens dos estados testados e relatórios são gravados em `output/browser/` e `output/online/`. O teste de recursos externos confirma que o jogo só solicita arquivos da própria origem.
- A skill de desenvolvimento de jogos também foi usada para executar o cliente Playwright de ações curtas e inspecionar seus screenshots/estados.

`window.render_game_to_text()` expõe um resumo legível do estado. `window.advanceTime(ms)` ativa o avanço manual para automação. Apenas a URL com `?test` oferece `window.__game` para fixtures, snapshots e comandos de teste; `?test&race` começa direto na corrida. Jogue na URL sem esses parâmetros para usar o relógio normal.

## Limites desta versão

É uma primeira versão funcional, ainda aberta a ajustes de dificuldade e sensação de controle após testes humanos. O cenário é 2.5D, a física é arcade e o som é sintetizado. Os desenhos das três motos compartilham a silhueta básica, com cores e comportamento diferentes. A meta é 60 FPS, mas o resultado depende do dispositivo e do navegador. A validação automatizada usou Chromium desktop e viewport móvel, não uma matriz de celulares físicos.

## Fontes e licenças

Barlow e Barlow Condensed, de Jeremy Tribby, são distribuídas sob SIL Open Font License 1.1. As licenças estão em `public/fonts/`. A arte de pilotos, motos, veículos, paisagens e ícone foi criada neste projeto, sem assets da franquia de referência.
