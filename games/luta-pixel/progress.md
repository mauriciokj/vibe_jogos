Original prompt: LUTA — Crie um jogo de luta 2D com visão lateral 4 personagens selecionáveis, com sprites 2D Estilo pixel art

- Estrutura inicial criada em HTML/CSS/Canvas, sem dependências de runtime.
- Atlas original com Kael, Nyx, Brutus e Yara gerado em pixel art e convertido para PNG transparente.
- Implementados seleção, melhor de três rounds, cronômetro, vida, energia, golpes leve/pesado/especial, defesa, pulo, IA e controles touch.
- Hooks `window.render_game_to_text` e `window.advanceTime(ms)` incluídos para testes determinísticos.
- Playwright validou tela inicial, navegação na seleção, entrada no round, aproximação dos lutadores, golpes da IA e atualização de vida/energia sem erros de console.
- Revisão visual concluída para título, seleção e luta; contador de combo corrigido para pertencer ao atacante.
- Pulo validado (posição e velocidade verticais), defesa validada reduzindo dano, pesado validado com dano/energia, especial validado consumindo 50 de energia e gerando impacto/projétil.
- IA rebalanceada para atacar com pausas mais justas e corrigida para entrar no alcance dos golpes contra um jogador parado.
- Teste de longa duração revelou lançamento vertical sem troca de estado; correção aplicada para marcar o alvo como aéreo.
- Partida completa validada até `matchOver`: dois rounds da CPU, placar 0–2, derrota e comando de nova luta retornando à seleção; alvo lançado retorna corretamente ao chão.
- Validação final do cliente Playwright concluída após as correções: seleção de Nyx, round contra Brutus, pulo, HUD e sprites sem erros de console.
- TODO opcional: adicionar novas arenas e animações quadro a quadro em uma expansão futura.
