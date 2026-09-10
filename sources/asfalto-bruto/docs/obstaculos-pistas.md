# Obstáculos por estrada

Disponíveis no individual e multiplayer, em Dia, Entardecer, Noite e Chuva. O servidor decide as colisões; o cliente compartilha previsão dos saltos e relógio das travessias.

| Pista | Situações | Como passar |
| --- | --- | --- |
| Serra da Fumaça | Três árvores caídas nas retas, cobrindo três das quatro faixas. A faixa livre alterna de lado. | Dois toques no acelerador para empinar antes da árvore e saltar. Consome uma das três empinadas. Sem cargas, use a faixa livre. Contato sem salto causa queda. |
| Vale Vermelho | Cinco bolas de feno rolando com o vento e duas travessias de tatu, com fases determinadas pela corrida. | Feno causa pequena perda de velocidade; contato com tatu derruba. Ambos podem ser evitados. Animais sem violência gráfica. |
| Porto Ferrugem | Dois trechos de obras fecham meia pista. Cinco carros esperam em cada um: uma fila no seu sentido e outra no sentido contrário. | Desvie pela metade aberta. Trânsito que chega por trás para na fila, sem atravessar carros. Carros parados e barreiras continuam causando colisão. |
| Terra Brava | Quatro rampas baixas de terra irregular ou lenha, alternando faixas em retas. | Passar por cima a partir de 29km/h lança a moto automaticamente. Não gasta empinadas, funciona com zero cargas. O salto não permite atravessar carros ou caminhões. |

As árvores usam madeira, galhos e folhas; tatus têm carapaça e passos; feno gira e quica; rampas têm materiais distintos. Impactos de árvore/lenha/terra usam som correspondente e aumentam o giro do motor durante o salto. O salto original sobre carro mantém o som metálico.

A polícia tem a maior velocidade máxima: **353km/h**, acima da melhor moto com motor totalmente melhorado e nitro. Continua freando nas curvas e escolhendo qualquer piloto próximo, humano ou CPU; não fica presa a perseguir o jogador local.

Geometria e posição em `src/game/hazards.ts` e `src/game/port.ts`; colisões em `simulation.ts`; saltos em `stunts.ts`; arte em `hazard-art.ts`. Travessias calculam x a partir do relógio, sem usar aleatoriedade a cada frame. O retorno ao ponto inicial acontece fora do acostamento. IA antecipa obstáculos largos e não escolhe uma ultrapassagem para dentro deles.

Validação: `npm test`, `npm run test:hazards`, loop de ações da skill. O browser aceita `PUBLIC_URL` e `QA_DIR` para conferir HTTPS com contextos descartáveis em `?test`, sem enviar corridas artificiais ao ranking.

Os obstáculos entraram em regras2. Após as novas quedas, o ranking atual usa regras3; regras2 e regras1 permanecem acessíveis no Histórico. A atualização não altera créditos, garagem ou recordes pessoais. Protocolo multiplayer13 impede misturar clientes com regras antigas.
