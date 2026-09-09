# Campeonato

Modo individual opcional, acessível pelo botão **Campeonato** no menu. Corrida livre e multiplayer continuam disponíveis.

## Estrutura

Cinco etapas, na ordem atual das estradas: Costa do Sol, Serra da Fumaça, Vale Vermelho, Porto Ferrugem e Terra Brava. Cada etapa contém quatro corridas: Dia, Entardecer, Noite e Chuva. Não depende dos desbloqueios da corrida livre.

| Lugar na corrida | Pontos |
| --- | --- |
| 1º | 10 |
| 2º | 6 |
| 3º | 4 |
| 4º | 3 |
| 5º | 2 |
| 6º | 1 |
| 7º, 8º ou não terminou | 0 |

A classificação aparece depois de cada corrida. Ao terminar a quarta, os três primeiros na soma da etapa avançam. A próxima estrada começa com zero pontos. Quem termina em quarto ou abaixo precisa recomeçar pela Costa do Sol; dinheiro e compras permanentes são preservados. Na última etapa, o primeiro é campeão e segundo/terceiro concluem o campeonato no pódio.

Desempates: maior número de melhores colocações (vitórias, segundos lugares etc.), menor tempo total e ordem inicial de largada. Um abandono recebe tempo de 360 segundos apenas no desempate, e nunca pontos; empates completos seguem a ordem da frente para trás na largada. Os mesmos sete rivais disputam as quatro corridas; após a chegada do jogador, a simulação real continua em uma cópia para apurar chegadas, prisões, quebras e limite de tempo dos adversários. Não se atribuem pontos a quem ainda está na pista.

## Garagem e continuidade

- A garagem fica disponível antes da primeira etapa e entre as etapas de quatro corridas.
- Moto, melhorias e equipamentos são definidos na entrada da etapa. Danos da moto continuam entre as quatro corridas; os rivais também carregam seus danos. O reparo básico automático da Ferro continua exclusivo da corrida livre.
- Sair para o menu e usar a garagem da corrida livre não repara nem modifica a moto já inscrita na etapa. Essas compras passam a valer na próxima etapa. Nitro consumido é descontado; não pode ser reabastecido durante a etapa.
- Saúde do piloto e cargas de empinar recomeçam por corrida, conforme as regras existentes. Integridade da moto e estoque de nitro não são restaurados entre corridas.
- Prisão, moto destruída, limite de tempo ou abandono: zero pontos, sem repetir aquela corrida. Abandono explícito está no menu de pausa. A corrida não oferece o botão de reiniciar.
- O resultado paga os créditos normais e o bônus de recorde pessoal aplicável, uma única vez. Campeonato não envia resultados ao ranking online de corrida livre.
- O progresso e uma cópia da corrida em andamento são salvos localmente a cada três segundos de simulação e ao ocultar/fechar a página. Reabrir permite retomar a corrida, preservando dano, posição, saúde, nitro e cargas. Com conta Google, usa a sincronização e resolução de conflitos existentes para continuar em outro dispositivo.

## Implementação e verificação

`src/game/championship.ts` concentra estado, pontuação, transições, continuidade da simulação e validação de saves. `src/championship-ui.ts` e `src/championship.css` apresentam a tabela e navegação. O save v1 ganha o campo opcional `championship`; saves antigos continuam válidos. A API de conta aceita até 128 kB no salvamento, com campeonato limitado a 100 kB e snapshots validados; autenticação e comparação de revisão permanecem iguais. Física, protocolo multiplayer 12 e regras de ranking 2 não mudam.

Validação automatizada: `npm test` e `npm run test:championship`. O browser percorre as vinte corridas com cenários de aproximação da chegada, qualificação, eliminação, todos os motivos de abandono, reparos entre etapas, reload durante corrida, pagamento único, interface em 390/320 px e preservação da corrida livre/multiplayer. Testes de conta usam SQLite descartável e dois clientes autenticados de teste, sem dados públicos.
