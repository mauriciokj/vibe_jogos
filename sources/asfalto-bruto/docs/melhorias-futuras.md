# Asfalto Bruto — melhorias futuras

Ideias solicitadas pelo usuário em 2026-09-08. Registradas para implementação futura; este documento não altera o jogo publicado nem define a prioridade da próxima entrega.

O planejamento de cenários e traçados está em [planejamento-pistas.md](planejamento-pistas.md).

## Empinar e saltar sobre carros

### Requisitos do usuário

- Dois toques seguidos no acelerador fazem o piloto empinar a moto.
- Enquanto empina, o piloto pode saltar sobre carros que vêm na contramão.
- A manobra tem limite de **3 usos por piloto em cada pista/corrida**.
- **Não é possível saltar sobre caminhões.** Eles continuam sendo obstáculos que exigem desvio.

### Detalhes a definir na implementação

- Janela entre os dois toques, duração da empinada, velocidade necessária, trajetória do salto e aterrissagem.
- Momento em que um uso é consumido: ao ativar a manobra ou ao executar o salto. Preservar o limite de três; não presumir usos ilimitados de uma mesma ativação.
- Como iniciar o salto a partir da empinada: reação automática à aproximação do carro ou outra ação. O único comando já definido é o toque duplo para empinar.
- Tratamento de vans, ônibus e tratores. O pedido define carros na contramão como elegíveis e caminhões como inelegíveis; os demais veículos ainda precisam de regra.
- Interação com curvas, chuva, golpes, quedas e polícia, sem transformar a empinada em proteção geral contra qualquer colisão.

### Direção de implementação proposta

- Reconhecer duas pressões distintas no teclado e no acelerador de toque; segurar o botão não deve contar como toque duplo por repetição de tecla.
- Exibir os usos restantes e devolver as três cargas ao iniciar uma nova corrida. Reconectar à mesma corrida não deve recarregá-las.
- Compartilhar estado, consumo de carga e colisões no multiplayer, com validação pelo servidor e animação em ambos os clientes. Preservar o modo individual.

## Porto Ferrugem: passageiro pendurado no caminhão

### Referência solicitada pelo usuário

Em uma aparição rara, um dos caminhões que vêm na direção contrária traz um personagem pendurado, fazendo referência ao meme descrito pelo usuário como o homem que se pendurou em um caminhão para defender Bolsonaro.

- Esta passa a ser a ideia de easter egg do Porto Ferrugem, substituindo a sugestão anterior do tentáculo de polvo.
- O personagem é **apenas visual**, sem alvo, interação, dano, recompensa, aviso ou efeito sobre a dirigibilidade.
- O caminhão mantém suas colisões e regras normais. A decoração não altera dimensões, velocidade, trajetória nem a proibição de saltar sobre caminhões.
- Associar a aparição a um caminhão da própria simulação, com a mesma ocorrência para os participantes online e sorteio independente da física.
- Adaptar iluminação e visibilidade a Dia, Entardecer, Noite e Chuva, preservando a leitura do veículo e da pista.

## Equipamentos de combate permanentes na garagem

### Requisitos do usuário

Comprar e equipar objetos para golpear os rivais pela garagem, de forma semelhante à compra e seleção de motos:

| Item solicitado | Característica definida |
| --- | --- |
| Corrente | Dano próprio, diferente dos outros itens. |
| Bastão de beisebol | Dano próprio, diferente dos outros itens. |
| Garrafa | Dano próprio, diferente dos outros itens. |

- **A compra é permanente: o jogador não perde o item.**
- A propriedade deve continuar salva entre corridas, inclusive após queda, prisão ou derrota; não exigir recompra.
- A garrafa também é um equipamento permanente, não um consumível. Uma eventual animação de quebra não deve remover o item comprado.

### Detalhes a definir na implementação

- Preços e valores de dano; o pedido não estabelece qual item deve ser mais forte.
- Alcance, velocidade do golpe, intervalo entre ataques e animações, caso sejam usados para diferenciar os equipamentos além do dano.
- Relação com o bastão básico e o roubo de arma já existentes: a nova regra não permite remover permanentemente um item comprado. Qualquer troca temporária durante uma corrida precisa ser definida separadamente.
- Acesso aos equipamentos no multiplayer: decidir se todos ficam disponíveis como as motos de fábrica atuais ou se são usadas as compras da campanha. Não modificar silenciosamente a separação atual entre campanha e online.
- Comando para usar o equipamento escolhido e eventual troca durante a corrida. A seleção na garagem já faz parte do pedido.

### Direção de implementação proposta

- Salvar IDs dos itens comprados e do equipamento selecionado, preservando créditos, motos, melhorias e recordes dos saves existentes.
- Mostrar preço, dano e estado de compra/equipamento na garagem.
- No multiplayer, validar equipamento e dano no servidor; o cliente não deve enviar valores de dano livremente.
