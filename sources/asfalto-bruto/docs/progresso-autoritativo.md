# Beta 1.1.0 — progresso confirmado pelo servidor

O usuário identificou que editar a garagem no localStorage permitia enviar saldo e itens inventados para a conta. A API antiga validava identidade, revisão e formato, mas aceitava o conteúdo econômico do navegador. Isso não provava que uma compra ou recompensa tinha ocorrido.

## Migração do beta

Por decisão do usuário, o progresso já existente nas contas é o ponto de partida confiável. Não há reset de dinheiro, motos, joelheiras, armas, capacetes, recordes ou campeonato. Na abertura do banco, `beta_baseline` registra uma cópia única dessas garagens; `economy_meta` impede repetir a importação. Os bancos continuam fora das pastas de publicação e recebem backup antes da ativação.

O endpoint antigo `/save` recusa substituições completas, mesmo com sessão, CSRF e revisão válidos. Contas novas recebem a garagem inicial calculada no servidor. A garagem de convidado continua local e independente; não é importada automaticamente para a conta. Não há como distinguir uma compra antiga legítima de uma edição manual de um save que nunca chegou ao servidor.

## Operações da garagem

`POST /action` recebe uma intenção, como comprar moto, melhorar motor, reparar ou equipar capacete. `server/economy.ts` carrega a garagem do SQLite e usa as funções compartilhadas do jogo para calcular preço, propriedade, capacidade e resultado. Campos extras de saldo/atributos não concedem nada.

Revisões evitam aplicar uma compra a uma garagem desatualizada. Recibos duráveis identificam o pedido exato: uma resposta perdida pode ser reenviada sem cobrar duas vezes. O navegador mantém a requisição pendente e aceita a garagem canônica retornada. Até uma cópia local adulterada com a mesma revisão é substituída ao conectar.

## Corridas individuais e campeonato

`POST /start` cria a corrida a partir da garagem oficial. O servidor escolhe a seed e registra o estado inicial. Uma conta tem uma única corrida individual ativa, que pode ser retomada após recarregar. O estoque de nitro é reservado na largada.

O navegador continua simulando e desenhando a 60 passos por segundo. Envia trechos de comandos compactados a `/checkpoint` aproximadamente a cada três segundos e tenta guardar o trecho pendente em IndexedDB. O servidor reproduz esses comandos com a mesma física, confere tempo decorrido e limites, e salva apenas o estado que ele calculou. Nunca recebe posição, integridade, prêmio ou classificação como verdade. Durante a verificação, cede o processamento a cada 60 passos, com limite de verificações simultâneas.

`POST /finish` confirma a chegada ou derrota e grava, na mesma transação, o resultado, o prêmio, o consumo de nitro e o recibo de conclusão. O bônus de recorde pessoal segue a regra de 30%. Abandonar voluntariamente não concede ajuda em dinheiro. Nitro não utilizado retorna após conferência. Repetir uma chegada não repete o prêmio.

No campeonato, o servidor também continua a simulação dos adversários, calcula pontos e decide classificação ou eliminação. Integridade e equipamentos ficam presos à etapa como antes, incluindo a exceção de reparo quando a moto chega a zero. Checkpoints anteriores ao corte do beta são aceitos como parte da base confiável. As novas alterações são verificadas.

O campeonato continua fora do ranking de corrida livre; as regras de física do ranking permanecem na versão 3. Corridas finalizadas e trechos temporários podem ser removidos após 24 horas ao iniciar novas corridas. Corridas ativas permanecem para retomada; resultados permanentes e recibos econômicos ficam no banco.

## Multiplayer

Na entrada da sala, o servidor consulta a conta e aceita apenas motos possuídas e equipamentos oficiais. Atributos de fábrica continuam valendo no online. Convidados podem jogar com a Ferro 500 e o equipamento básico.

As cargas são reservadas antes de entrar. Sala inválida ou saída do lobby devolve a reserva; corrida devolve apenas cargas que o servidor sabe que não foram consumidas. Recibos tornam devoluções idempotentes. Uma conta não ocupa duas salas nem uma sala e uma corrida individual simultaneamente.

O protocolo multiplayer passa de 13 para 14 para exigir atualização das abas antigas. Na VPS de processo único, salas em memória não sobrevivem a reinício; reservas antigas são encerradas com base no consumo registrado. A recuperação de reservas não deve ser executada por vários processos que compartilhem salas externas ativas.

## Limites reais

- Não promete impedir toda trapaça. Automação de comandos e assistência externa continuam possíveis; replay válido não prova que foi uma pessoa pilotando sem ajuda.
- O convidado pode modificar seu jogo local. Isso não dá saldo, equipamentos ou recordes oficiais à conta.
- Para largar ou comprar usando a conta, é necessária conexão. Uma corrida já iniciada pode guardar comandos durante uma interrupção, mas o progresso só é confirmado após a conferência. A retomada usa o último ponto confirmado; apagar os dados locais pode perder comandos ainda não enviados.
- É possível jogar sozinho como convidado sem conta. A garagem de convidado continua disponível ao sair do Google.

## Versões e notas

`src/version.ts` é o identificador do produto, separado de `NET_VERSION` e `RANK_RULES`. Ao publicar uma atualização, atualizar também a versão do pacote e acrescentar uma entrada em `src/releases.ts` com mudanças reais e data. O menu abre o histórico por botão, teclado e toque. A API de saúde informa `appVersion`.

As publicações antigas nunca tiveram números próprios na interface. Por isso o histórico usa suas revisões Git e datas, sem inventar números de versões passadas.

## Verificação

- Testes de migração preservando saldo, equipamentos e revisão antigos.
- API autenticada recusando edição de save, com origem e CSRF válidos.
- Compra, saldo insuficiente, limite de nitro, revisão obsoleta e repetição de pedido.
- Replay real, checkpoint, retomada, prêmio único, abandono e classificação do campeonato.
- Equipamento multiplayer adulterado, reservas, devolução e reinício do serviço.
- Navegador: Google simulado apenas no ambiente local, dois dispositivos, localStorage adulterado, resposta perdida, corrida real, campeonato, convidado e histórico responsivo.

Artefatos locais de QA: `output/economy-qa/`. Nenhuma conta falsa de teste é criada em produção.
