# Bicicleta secreta — Beta 1.3.0

Pedido: um veículo secreto que seja revelado ao cair perto da chegada e cruzar a linha a pé. Na garagem bloqueada, só um cartão preto com “item ainda não disponível”.

- **Magrela:** bicicleta grátis após a conquista, permanente, sem equipar automaticamente. Mantém as compras, saldo e moto selecionada.
- O piloto precisa estar caminhando, ter sofrido uma queda e cruzar a linha de antes para depois. Vale qualquer pista e condição, no individual, campeonato ou multiplayer. Deslizar além da linha, ficar parado depois dela, cruzar só com a moto ou ser eliminado não concede o item. Pode voltar a pé para antes da linha e cruzar novamente.
- O resultado recebe `onFoot` somente na simulação. O servidor reproduz os comandos do individual/campeonato; no multiplayer usa o resultado da sala. `unlockBicycle` concede a posse uma única vez e a operação da loja recusa o veículo ainda bloqueado. Não se aceita um desbloqueio enviado pelo navegador.
- A conta recebe a conquista no mesmo salvamento do resultado, com recibo idempotente. Convidados a guardam no navegador; como os demais equipamentos, para usar a garagem no multiplayer é necessário jogar conectado à conta. Não há importação de um save local para a conta.
- **Pedalar:** aperte e solte W/↑ repetidamente, ou toque na parte superior do acelerador analógico no celular. Cada ação fornece0,36s de esforço, com reserva limitada a0,5s e intervalo mínimo de0,14s. Segurar não renova o esforço. Frear cancela o esforço pendente. Ações online têm sequência e confirmação, para reenvios não virarem novas pedaladas.
- Bicicleta arcade: velocidade-base60 km/h (ajustada na Beta1.4.0; transmissão preserva o ganho proporcional anterior), aceleração13,8m/s², agilidade1,6 e resistência0,7. Não usa motor, nitro, joelheira ou empinada por toque duplo; rampas e colisões continuam funcionando. A melhoria “Transmissão” ocupa o lugar do motor. Arte original em Canvas com quadro, rodas raiadas, pedais e pernas animadas, também no retrovisor e ao cair.
- Ao chegar a pé, o piloto continua a pé na comemoração. Se venceu, ergue os braços; a câmera se afasta e a moto fica onde caiu. Pilotos concluídos não voltam a buscar a moto nem recebem atropelamentos após a chegada.
- Os sete modelos dos adversários e sua física permanecem iguais: a bicicleta não aparece em bots, preservando o segredo e a dificuldade atual. Protocolo multiplayer15; histórico de ranking/regras3 preservado.

Verificações: `npm test`, `npm run test:bicycle` e cliente Playwright da skill. Fixtures de desbloqueio e contas de QA ficam somente nos testes; produção usa a conquista real.
