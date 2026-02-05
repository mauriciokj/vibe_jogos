Original prompt: Criar um clone 3D low-poly retrô do Enduro (Atari) com Three.js puro em módulos (main.js, Game.js, Road.js, PlayerCar.js, AICar.js, Spawner.js, Collision.js, Phases.js, HUD.js, Audio.js), start screen, pseudo-3D de estrada, controles esquerda/direita, AI por classes, ultrapassagem, colisão com stun, fases DAY/NIGHT/FOG/SNOW, HUD DOM, áudio retrô e pooling/performance.

- Estrutura inicial criada com `index.html`, `style.css` e todos os módulos solicitados.
- Loop principal implementado em `Game.js` com estados START/PLAYING/PHASE_TRANSITION/FAILED.
- Implementados: HUD start + status, spawn com object pooling, overtake decrementando `carsLeft`, colisão com stun e flash, progressão de fases e escalonamento de dificuldade.
- Implementados hooks de teste: `window.render_game_to_text` e `window.advanceTime(ms)`.
- Próximo passo: rodar loop de validação Playwright da skill e ajustar se houver erros visuais/controle/console.
- Tentativa de teste automatizado com Playwright client executada; bloqueada por dependência ausente (`playwright`) e sem acesso de rede para instalar (`ENOTFOUND registry.npmjs.org`).
- Ajuste aplicado em `Game.js`: headlight da fase NIGHT agora anexado corretamente ao carro do jogador.
- Snake extraído para subpasta dedicada `snake-classic/` para não misturar com Enduro da raiz.
- Snake recebeu placar com nome + score e persistência local no navegador.
- Bug corrigido: teclas globais não disparam restart enquanto o foco está no input de nome.
- Placar global implementado em `snake-classic/server.mjs` com API `GET/POST /api/leaderboard` e persistência em `snake-classic/data/leaderboard.json`.
- Front do Snake atualizado para consumir API global com fallback automático para modo local/offline.
- Testes adicionados/atualizados em `snake-classic/tests/*.test.mjs` e validados (10 passando).
- Melhoria de feeling aplicada: penalidade de velocidade em stun/borda, perda de tempo ao bater, escalonamento leve de velocidade por dia e pulse visual em ultrapassagem.
- Polimento de fail/restart: mensagem mais clara (`PRESS R OR ENTER`), flash no fail e cooldown curto para evitar restart acidental.
