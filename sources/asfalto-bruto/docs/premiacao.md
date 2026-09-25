# Premiação de corridas e combate

O multiplayer usa a mesma premiação por colocação do individual e do campeonato, calculada sobre o prêmio anunciado da pista:

| Colocação | Percentual |
| --- | --- |
| 1º | 100% |
| 2º | 80% |
| 3º | 64% |
| 4º | 50% |
| 5º | 40% |
| 6º | 32% |
| 7º | 25% |
| 8º | 20% |

Os valores são arredondados para moedas inteiras. Prisão, moto destruída e tempo esgotado recebem a mesma ajuda de 120 moedas do individual. Abandonar voluntariamente não paga prêmio base nem ajuda da oficina. Sair do lobby não paga nada.

## Bônus por derrubadas

- Cada rival humano ou CPU derrubado pelo jogador rende **50 moedas**.
- Cada policial derrubado rende **500 moedas**, sem somar mais 50.
- Derrubar a mesma pessoa novamente depois da recuperação paga novamente. Um golpe que não derruba, atingir alguém já caído ou uma queda causada pelo cenário não gera prêmio.
- O crédito segue a autoria de golpes e contatos da simulação. Se ambos caem no contato, cada um pode receber pelo rival que derrubou; a própria queda não rende dinheiro.
- Os bônus aparecem durante a corrida e são somados ao saldo no resultado, inclusive em derrota ou abandono. A tela discrimina os dois tipos e o total.

O bônus de recorde pessoal de 30% continua no individual/campeonato. Corridas online não alteram os recordes nem os desbloqueios de pistas da campanha.

## Persistência

Contas recebem o pagamento na transação do servidor, junto ao recibo da participação e ao acerto de nitro. Convidados salvam um recibo por corrida no navegador. Reconectar, recarregar, sair após o resultado ou retornar à mesma sala não paga novamente. A próxima corrida tem outro recibo.

Não há pagamento retroativo por resultados ou conquistas anteriores. As contagens opcionais preservam compatibilidade com saves e checkpoints antigos. O protocolo **19** exige cliente e servidor atualizados juntos para aplicar a mesma regra aos convidados.

Validação: `npm run test:combat-rewards`, `npm run test:room-continuation` e `npm run test:police-reward`, além dos testes gerais e build.
