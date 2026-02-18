Original prompt: novo jogo em uma nova pasta
utilize o framework phaser

Sombra Escala
Conceito: Você controla uma sombra que só pode se mover sobre as silhuetas projetadas por objetos em movimento. O objetivo é subir o mais alto possível antes que a luz mude de posição e apague seu caminho.

Mecânica Central (Core Loop): Espere o timing do objeto, pule na sombra e suba antes que o "chão" desapareça.

- Estrutura inicial criada em `games/sombra-escala-phaser`.
- Base Phaser implementada com menu, gameplay e game over.
- Mecânica principal implementada:
  - movimento horizontal apenas sobre silhuetas
  - salto para trocar de plataforma/sombra
  - sombras oscilando horizontalmente com timing
  - troca periódica da luz apagando/recriando caminhos
- Hooks de automação adicionados: `window.render_game_to_text` e `window.advanceTime(ms)`.
- Correcao aplicada: camera vertical agora acompanha subida (antes ficava travada).
- Validacao Playwright executada com `web_game_playwright_client.js` usando URL `file://`:
  - sem erros de console/pageerror nos cenarios executados
  - estados e screenshots salvos em `output/web-game/sombra-escala*`
- TODO: iterar balanceamento de dificuldade para facilitar ganhos de altura mais consistentes.
- Rework completo de design/gameplay para alinhar com o novo conceito:
  - parede branca + sombras pretas projetadas por viga/pendulo/engrenagem
  - jogador preto carregado pela sombra em movimento
  - exposicao fora da sombra com limite de 0.5s
  - derrota por exposicao, queda e esmagamento por sobreposicao de sombras
  - faiscas de escuridao como bonus de multiplicador
  - sistema de andares alvo (500m, 1000m...) e desbloqueio progressivo de tipos
- Legibilidade do menu melhorada (tipografia menor + caixa de alto contraste).
- Inicio ajustado com plataformas tutorial para reduzir aleatoriedade nos primeiros saltos.
