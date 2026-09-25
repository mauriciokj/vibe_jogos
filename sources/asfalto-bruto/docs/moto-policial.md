# Moto da polícia

No individual e no campeonato, um jogador a pé pode roubar a moto de um policial caído. Basta caminhar até a moto parada antes de o policial chegar para remontar. A montagem é automática; em empate ou se o policial já estiver remontando, ele fica com a moto. Uma moto destruída não pode ser roubada.

O jogador continua com sua saúde, roupa, capacete, arma e joelheira. Recebe a moto com os atributos e danos que ela já tinha, sem nitro, cura ou poderes de polícia. A moto original permanece no chão, e o policial fica a pé. Outros policiais continuam podendo prender o jogador pelas regras normais.

Cruzar a chegada montado na moto roubada desbloqueia a **Patrulha 900** na garagem. Não é necessário vencer. Abandonar, perder ou chegar a pé não a desbloqueia. Cair novamente e recuperar a moto roubada antes da chegada continua sendo válido.

O desbloqueio não dá moedas, conquista, equipamento ou reparo extra e não troca automaticamente a moto selecionada na garagem. Os danos da Patrulha são conservados. O prêmio de 500 moedas por derrubar um policial é independente e mantém suas próprias regras.

A Patrulha pode ser equipada no individual e no campeonato. O multiplayer não permite o roubo nem o uso da Patrulha, mesmo para uma conta que a possui. A restrição existe na interface e no servidor.

## Persistência

O save e o campeonato registram separadamente a moto inscrita e a roubada, preservando os danos e o nitro não usado da original. Retomar uma corrida salva mantém o jogador na moto roubada. A próxima etapa do campeonato usa a moto inscrita, conforme o bloqueio existente da garagem entre etapas.

Para convidados, o desbloqueio fica salvo no navegador. Para contas, o servidor reproduz os comandos, confirma o roubo e a chegada, e grava a posse na garagem da conta; um resultado alegado pelo cliente não concede a moto.

## Validação

- `npm test`: regras, persistência, campeonato, replay oficial e rejeição no multiplayer.
- `npm run test:police-theft`: testes específicos e navegador em 1440×900, 390×844 e 320×568; roubo, chegada, garagem, recarga, abandono e conta em outro aparelho.
- `npm run build`: TypeScript e build de produção.

Artefatos locais de navegador: `output/police-theft/`.
