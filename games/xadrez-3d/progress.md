Original prompt: Criar um jogo de xadrez 3D completo em um único arquivo HTML, sem bibliotecas externas, usando WebGL direto, regras integrais, engine minimax e interface sobreposta.

- Estrutura inicial definida: `games/xadrez-3d/index.html` será autocontido (HTML, CSS, GLSL e JavaScript).
- Implementados renderizador WebGL2, shaders Blinn-Phong, shadow mapping, câmera orbital e picking por raio.
- Implementadas malhas por revolução para cinco famílias de peças e cavalo com corpo extrudado próprio.
- Implementadas regras legais, roques, en passant, promoções, estados de fim, SAN e desfazer.
- Implementada engine alfa-beta em fatias assíncronas, profundidades 4–6, tabelas posicionais e quiescência.
- Adicionados `render_game_to_text`, `advanceTime` e API `Chess3D` para testes.
- Validação programática passou para 20 lances iniciais, roques, roque através de ataque bloqueado, en passant, quatro promoções, mate, afogamento, material insuficiente, cravada, 50 lances e repetição tripla.
- Picking real validado movendo e2–e4; engine nível 4 respondeu sem bloquear em cerca de 8 segundos no navegador headless.
- Corrigida a unidade de tempo das animações e enquadramento desktop ajustado para manter o tabuleiro clicável ao lado do painel.
- Playwright final repetido sem erros: posição inicial, seleção com destinos legais, movimento por picking e perspectiva invertida foram capturados e inspecionados.
- `preserveDrawingBuffer` ativado para capturas WebGL determinísticas nos testes; antialiasing permanece habilitado.
- QA final: JavaScript analisado sem erros; HTML tem 46 KB e não contém scripts, links ou bibliotecas externas.
- Estado final: implementação concluída e pronta para uso.
