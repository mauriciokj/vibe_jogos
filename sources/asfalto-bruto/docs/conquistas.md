# Conquistas — Beta 1.4.0

São 25 conquistas, acessíveis no cartão ao lado do campeonato. O catálogo e os objetivos estão em `src/game/achievements.ts`. Treze objetivos ficam visíveis desde o início; doze desafios difíceis/secretos escondem nome, descrição e progresso com “???”, até a conquista. Há filtros Todas, Conquistadas e Pendentes, contador e aviso no resultado.

## Regras

- Feitos são acumulados na simulação e registrados ao terminar ou abandonar a corrida, inclusive quando o resultado é prisão, quebra ou tempo esgotado. Vitórias e desafios de chegada exigem resultado `finish`; abandonos não valem como vitória. Reiniciar uma prova iniciada também interrompe a sequência de vitórias.
- Derrubadas são atribuídas ao piloto que causou a queda por golpe ou contato. Cada adversário só conta uma vez; quedas por obstáculos e acidentes de outros pilotos não dão crédito ao jogador. Policiais são separados da lista de adversários da classificação.
- Saltar um carro exige cruzar sua posição com altura suficiente, no salto direcionado a ele. Empinar sem passar pelo carro não conta. Três saltos exigem três carros diferentes. Na Terra Brava, “Pedra no caminho” usa os obstáculos de salto já existentes, blocos de terra e madeira; não foi criado outro obstáculo.
- Joelho de aço acompanha uma curva completa: o piloto precisa entrar antes de seu começo, usar o joelho por pelo menos 0,5 segundo durante ela e sair pelo final, sem cair nem ultrapassar a borda da pista. Não exige apoiar o joelho durante toda a curva.
- Virada histórica verifica a posição ao cruzar metade da distância. Último segundo exige passar o líder da prova nos últimos 100 metros e vencer. Sem um arranhão exige não perder saúde nem integridade durante a corrida, mesmo que o veículo já largue desgastado.
- Sequência de três vitórias pode misturar individual, campeonato e multiplayer. Qualquer derrota/abandono encerra a sequência; uma medalha já conquistada permanece.
- Vencer em todos os climas exige as quatro condições da mesma pista. Passaporte carimbado exige terminar nas cinco pistas. Etapa perfeita exige as quatro vitórias dentro da mesma etapa do campeonato; Lenda exige terminar o campeonato como primeiro na classificação da última etapa. Garagem dos sonhos exige as sete motos convencionais.
- A chegada a pé mantém a recompensa existente: Magrela grátis e permanente. As demais conquistas são medalhas, sem novos prêmios de dinheiro ou equipamentos.

## Persistência e migração

Convidados salvam no navegador. Contas recebem feitos do replay oficial ou da simulação multiplayer, na mesma transação/recibo da corrida; um JSON de conquistas enviado pelo cliente não é aceito. Novos campos opcionais preservam saves, campeonatos e checkpoints antigos. IDs e progressos persistidos são normalizados e limitados ao catálogo.

A posse anterior da Magrela comprova Na raça. Records de pista/clima e histórico do campeonato permitem reconhecer somente fatos comprovados. A tabela de resultados do servidor recupera também vitórias individuais/online antigas, uma vez por conta; `achievement_imports` impede que esses dados reapareçam após reiniciar o progresso. Não se inventam derrubadas, saltos, sequência de vitórias ou corridas sem dano do passado.

## Ajuste da Magrela

Velocidade de fábrica: 60 km/h. A transmissão preserva o ganho relativo anterior (+2,5/58 por nível), chegando a aproximadamente 67,8 km/h no nível 3. Aceleração, resistência e dirigibilidade mantêm seus ganhos anteriores; pedaladas continuam obrigatórias.

O prazo multiplayer das motos continua em 360 segundos. Para a bicicleta, o prazo por pista é calculado com a nova velocidade, margem de 70% e 90 segundos extras, sem prender quem já concluiu na sala. A simulação continua encerrando por prisão, quebra ou saída normalmente. Protocolo16; regras do ranking3 preservadas.

## Verificação

`npm test`, `npm run test:bicycle`, `npm run test:achievements` e cliente da skill de jogo web. QA de navegador cobre 12 tamanhos de menu, filtros/segredos, recompensa após salto e derrota, chegada a pé, legado, recarga, bicicleta móvel a60 km/h, resultado oficial de conta e outro dispositivo. Fixtures e alterações de posições ficam apenas nos testes.
