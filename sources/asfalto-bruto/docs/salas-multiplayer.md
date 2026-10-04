# Continuar jogando na mesma sala

Depois que todos os pilotos terminarem ou forem eliminados, a tela de resultado permite:

- **Próxima corrida:** registra a escolha e mostra quantos jogadores confirmaram. Quando todos escolhem essa opção, a sala avança para a próxima pista/condição da sequência do menu e larga após cinco segundos.
- **Correr de novo:** funciona com a mesma confirmação de todos, repetindo a pista e a condição atuais.
- **Voltar para a sala:** reabre a configuração para todo o grupo, mantendo código, jogadores, visibilidade e opção de bots. Fica disponível quando a prova encerra, sem interromper pilotos ainda na pista.
- **Sair da sala:** sai apenas o jogador que clicou.

A última corrida da sequência oferece repetir ou voltar à sala. É necessário ter ao menos duas pessoas para largar. Quem cai ou é preso também pode participar da próxima corrida depois que a prova atual encerrar.

## Configuração da sala

**Somente motos da garagem** pode ser marcada ao criar a sala pública ou por convite. Desmarcada por padrão, preserva a escolha livre dos sete modelos comuns. Ativada, cada jogador só pode escolher motos que possui. A regra é exibida na busca pública e no lobby e permanece ao repetir, avançar, voltar à sala, trocar de anfitrião ou reconectar. Para alterá-la, crie outra sala.

Contas usam o inventário oficial do servidor, ignorando declarações do navegador. Convidados usam a garagem local declarada ao entrar, sem comprovação de compra, como já ocorre com equipamentos. A lista é preservada durante a sessão e não pode ser ampliada numa troca de moto. Quem entra por convite ou busca pública com um modelo incompatível recebe a Ferro 500 e pode selecionar outra moto permitida no lobby. A Magrela continua exigindo desbloqueio em conta; Patrulha 900 continua fora do multiplayer. Bots mantêm seus modelos de fábrica.

Cada jogador escolhe sua própria moto. O anfitrião escolhe pista e condição; trocar a pista cancela as confirmações de todos. Trocar de moto cancela a confirmação do próprio jogador. A escolha fica bloqueada durante os cinco segundos finais antes da largada.

O criador começa como anfitrião. Se ele sair, o próximo jogador conectado assume. A sala reaberta aguarda todos ficarem prontos, sem iniciar por um prazo de configuração. A sala criada pela primeira vez mantém o prazo já existente de 60 segundos, ou 120 segundos se pública.

As motos continuam com atributos de fábrica no multiplayer. Equipamentos e nitro de contas vêm da garagem oficial, e a Patrulha 900 continua bloqueada. Trocar a moto devolve o nitro reservado e não usado da anterior; continuar outra corrida usa apenas o estoque restante.

## Reconexão e registros

O código e as identidades dos participantes são preservados. Cada corrida tem seu próprio identificador de entrada para nitro, prêmios, conquistas e ranking. Confirmar novamente, recarregar ou reconectar não repete pagamentos. O resultado anterior acompanha a sala para permitir a confirmação de créditos de um convidado que reconecte durante a transição. O prêmio por colocação e os bônus de combate seguem [premiacao.md](premiacao.md).

Uma desconexão temporária reserva a vaga por 15 segundos e impede a confirmação unânime de largada durante essa recuperação. Quem sai explicitamente deixa de participar da confirmação. Se restar apenas uma pessoa, ela pode reabrir a sala e convidar outros jogadores.

A sala pública volta ao índice de busca quando reabre. As transições entre corridas foram introduzidas no protocolo18; a premiação usa protocolo19, a Mata usa protocolo20 e a opção de garagem usa protocolo **21**, exigindo atualização conjunta do cliente e servidor.

## Testes

- `npm run test:garage-only`: criação, entrada, propriedade de contas/convidados, troca, busca pública, reconexão e navegador em computador/celular.
- `npm run test:room-continuation`: regras, sockets, múltiplas corridas, contas, convidados e navegador em computador e celular.
- `npm run test:redis`: duas instâncias, retorno ao índice público, configuração compartilhada e próxima corrida. Requer Redis de teste em `ASFALTO_TEST_REDIS_URL`.
- `npm run test:finish`: regressão das cenas e navegação após a chegada.
- `npm test` e `npm run build`: testes gerais e compilação.

Capturas e estados locais ficam em `output/room-continuation/`.
