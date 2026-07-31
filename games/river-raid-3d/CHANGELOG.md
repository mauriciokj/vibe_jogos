# Changelog — Rio de Aço 3D

O jogo usa versionamento semântico:

- `PATCH` (`1.0.x`) para correções e ajustes de balanceamento.
- `MINOR` (`1.x.0`) para novas mecânicas, inimigos, ambientes e recursos.
- `MAJOR` (`x.0.0`) para grandes reformulações de progressão ou jogabilidade.

Cada publicação deve atualizar `GAME_VERSION` no `index.html` e registrar as mudanças neste arquivo.

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
