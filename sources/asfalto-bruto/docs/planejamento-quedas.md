# Quedas e recuperação a pé

Mecânica aprovada pelo usuário após testar o protótipo, a câmera fixa e a queda de joelho na chuva. Integrada à fonte principal; validação e publicação registradas em `progress.md` do projeto/catálogo.

## Durante a corrida

- Piloto e moto deslizam separados. Velocidade da queda, asfalto/terra e chuva determinam as distâncias. Uma colisão segura mais a moto; uma derrapagem pode deixá-la à frente do piloto.
- A câmera fica no ponto do impacto enquanto os dois se afastam. Ao começar a correr, passa a acompanhar suavemente; ao montar, volta gradualmente ao enquadramento de pilotagem. Corpo caído tem geometria 3D com sombras; corrida tem poses de frente e costas.
- Depois de levantar, W/↑ avança, S/↓ volta e A/D move para os lados. No celular, o analógico esquerdo controla os lados e o direito frente/trás. Encostar na moto parada inicia montagem (0,65 s). O jogador precisa buscá-la; os bots fazem a própria recuperação.
- Os mesmos guard rails/barrancos mantêm piloto e moto em locais alcançáveis. Não há chegada válida a pé.
- Carros e competidores podem atropelar pilotos caídos ou correndo: dano, novo deslocamento e atraso, com proteção entre impactos. A resistência fica no mínimo em 1 nesse contato; isso não adiciona eliminação por vida zerada.
- A moto caída de outro piloto funciona como rampa e não consome empinadas. Saltar não concede imunidade geral ao trânsito.
- A polícia pode prender o piloto a pé, inclusive se a moto estiver longe. Raio existente de 30 m preservado.
- Se uma queda zera a integridade, o piloto ainda pode buscar a moto. Ao tentar levantá-la, ela explode com som/fogo/fumaça e encerra a corrida após 1,8 s. Isso vale também para CPUs. Uma explosão iniciada não é substituída por prisão ou novo atropelamento.
- A manobra de joelho continua com 4 s de duração; mais de 2 s contínuos de contato na chuva provocam a queda. Choppers não fazem a manobra.

## Progresso e modo online

Garagem, dinheiro, equipamentos e consumíveis não são reiniciados por essa atualização. A recuperação não reabastece a moto nem equipamentos. Checkpoints do campeonato guardam fase, posições/velocidades separadas e origem do impacto. Um checkpoint de corrida em andamento com moto zerada permite retomar para concluir a recuperação; reparo durante a etapa continua restrito à moto em 0% entre corridas. Checkpoints antigos sem os campos novos continuam válidos.

Multiplayer usa protocolo13. Posição/velocidade do corpo e da moto vêm da simulação autoritativa; o cliente prevê o movimento e suaviza correções de ambos, sem confirmar sozinho montagem, dano, prisão ou explosão. Cópias profundas impedem a apresentação de modificar snapshots. Sem comandos recentes, um piloto a pé para; a frenagem de segurança de quem está montado não o faz correr para trás. Salas continuam opcionais, para 2–8 pessoas, com CPUs opcionais.

Ranking atual usa regras3, com replays verificados pela nova física. Regras2 e regras1 continuam consultáveis no Histórico; nenhuma linha de resultado antiga é apagada ou misturada com a classificação atual. Recordes pessoais do save são preservados.

## Arquivos e testes

- Física: `src/game/recovery.ts`, `simulation.ts`, `stunts.ts`, `types.ts`.
- Apresentação: `race-camera.ts`, `fallen-rider-art.ts`, `recovery-art.ts`, `renderer.ts`, `audio.ts`, `src/recovery.css`.
- Online: `src/multiplayer/presentation.ts`, `protocol.ts`, `server/room.ts`.
- Campeonato/conta: `championship.ts`, `championship-ui.ts`, protocolo/UI de ranking e API.
- `npm test`: recuperação, replay, câmera, protocolo, oito humanos, snapshot imutável, retomada, campeonato e regressões existentes.
- `npm run test:falls`: navegador individual/celular e dois clientes online com atraso/jitter. Artefatos em `output/falls-integration/`.

O laboratório `output/prototipo-quedas` continua isolado. Seus atalhos, créditos de teste, save separado, contas desativadas e configuração sem API não são publicados.
