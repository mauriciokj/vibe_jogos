# Changelog — Rio de Aço 3D

O jogo usa versionamento semântico:

- `PATCH` (`1.0.x`) para correções e ajustes de balanceamento.
- `MINOR` (`1.x.0`) para novas mecânicas, inimigos, ambientes e recursos.
- `MAJOR` (`x.0.0`) para grandes reformulações de progressão ou jogabilidade.

Cada publicação deve atualizar `GAME_VERSION` no `index.html` e registrar as mudanças neste arquivo.

## 1.8.0 — 2026-08-03

- Evento do Trem Armado desbloqueado a partir da rodada 4 em pontes ferroviárias alternadas.
- Locomotiva low-poly, dois vagões, rodas animadas, farol e torre atravessam a ponte da direita para a esquerda.
- Trilhos ficam presos ao tabuleiro da ponte; o trem aguarda a aproximação antes de iniciar a travessia com aviso próprio.
- A torre confirma a mira antes de lançar um projétil reto e evitável durante a passagem.
- Trem suporta seis acertos, vale 900 pontos e participa dos sistemas de combo e Turbo Score.
- Rodada 3 permanece sem trens; transição natural para a rodada 4 libera corretamente o evento.
- Projéteis dos tanques agora herdam o deslocamento visual do cenário sem perder sua velocidade própria em relação ao terreno, eliminando o recuo aparente em alta velocidade.
- Movimento, tiro, três câmeras, progressão e layout móvel foram preservados.

## 1.7.0 — 2026-08-03

- Bioma Jungle desbloqueado ao entrar na rodada 4; Vale Verde e Deserto continuam nas rodadas anteriores.
- Cinco momentos próprios: Dia Úmido, Entardecer, Noite, Chuva Tropical e Névoa Verde.
- Floresta mais densa, margens mais fechadas e canais mais estreitos criam uma identidade própria de navegação.
- Chuva tropical e névoa verde alteram visibilidade, iluminação, holofotes e velocidade dos inimigos.
- Frequência de FUEL e tanques recebeu balanceamento específico para a Jungle.
- Tanques agora confirmam a mira antes do disparo; seus projéteis seguem em linha reta até o ponto travado e podem ser evitados lateralmente.
- Movimento, tiro, três câmeras, pausa, transição de ciclo e layout móvel foram preservados.

## 1.6.0 — 2026-08-02

- Bioma Deserto desbloqueado ao entrar na rodada 3; as duas primeiras rodadas permanecem no Vale Verde.
- Cinco momentos próprios: Sol Forte, Entardecer, Noite, Tempestade e Amanhecer.
- Margens arenosas, cânions, cactos e partículas de areia substituem a vegetação do vale.
- FUEL fica menos frequente e tanques aparecem com maior probabilidade no Deserto.
- Transição de ciclo, três câmeras, pausa, controles e layout móvel preservados.

## 1.5.0 — 2026-08-02

- Tanques terrestres começam a aparecer nas margens somente a partir da rodada 3.
- Torres acompanham o avião dentro do alcance, sinalizam o travamento por 0,8 s e disparam projéteis visíveis.
- Projéteis podem ser evitados mudando de lado; um impacto remove uma vida.
- Tanques suportam três acertos, valem 450 pontos e participam do sistema de combo e Turbo Score.
- Seletor de simulação e estado textual indicam o desbloqueio dos tanques na rodada 3.
- A partir da rodada 5, tanques também podem ocupar o terreno central de bifurcações largas sem bloquear os canais.

## 1.4.0 — 2026-07-31

- Cada bifurcação oferece uma rota de FUEL e uma rota de combate com navios e helicópteros.
- Rota de combate concede multiplicador de pontuação ×1,35, acumulável com combo e Turbo Score.
- Lados das rotas alternam a cada bifurcação e são avisados antes da separação.
- Indicador no HUD identifica a rota atual; inimigos permanecem dentro do canal escolhido.
- Geometria da ilha fica oculta quando sua largura é zero, removendo a linha marrom do rio único.

## 1.3.0 — 2026-07-31

- Bifurcações procedurais liberadas somente a partir da rodada 2, abrindo o rio em dois canais e voltando a reuni-lo gradualmente.
- Canais ampliados antes de a ilha surgir e trecho dividido reduzido para 280 unidades.
- Ilha central low-poly com árvores, rochas, colisão própria e aviso antecipado.
- Navios permanecem no canal escolhido; entidades aquáticas nascem fora da ilha.
- Pontes são adiadas até um trecho de rio único e o avião reserva reaparece dentro de um canal seguro.
- Estado da bifurcação disponível nas três câmeras e na saída textual de testes.

## 1.2.0 — 2026-07-31

- `TURBO SCORE ×1,5` para destruições realizadas a partir de 52 unidades/s.
- Multiplicador acumulável com combos e indicador próprio no HUD.
- Recompensas fixas de evasão, rasante e ponte no limite continuam sem multiplicação.

## 1.1.0 — 2026-07-31

- Bônus `PONTE NO LIMITE` por destruir uma ponte a até 16 unidades do avião.
- Recompensa adicional de 500 pontos e aviso próprio na tela.

## 1.0.0 — 2026-07-31

- Primeira versão formalmente numerada.
- Três câmeras: Perseguição, Top-Down e Cockpit.
- Cinco fases ambientais no Vale Verde.
- Progressão com pontes, vidas, combustível, helicópteros, navios armados e lançadores de mísseis.
- Modo de segurança, alertas de ameaça e evasão perfeita.
- Combo por destruições consecutivas até ×5.
- Bônus `RASANTE PERFEITO` próximo às margens.
- Seletor secreto de rodada para simulações.
