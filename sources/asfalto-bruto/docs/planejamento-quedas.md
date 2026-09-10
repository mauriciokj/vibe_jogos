# Quedas, deslizamento e recuperação a pé

Pedido de 2026-09-09. **Viável; ainda não implementado.** O usuário pediu primeiro a correção dos rivais na largada e a cena do policial na chegada. Esta mecânica deve ser apresentada em uma versão de teste antes de qualquer publicação em produção: “antes de ir pra produção quero aprovar como ficou”.

## Comportamento desejado

- Na queda, piloto e moto deslizam separados; velocidade da batida determina a distância e o tempo de deslizamento.
- Depois de parar e levantar, o piloto precisa correr até a moto e montá-la para continuar. Enquanto isso, pode ser preso pela polícia.
- Carros, motos de outros competidores e o próprio jogador podem atropelar quem está caído ou a pé. O impacto causa dano e atrasa a recuperação, sem violência gráfica.
- Passar por cima da moto caída de um rival provoca um salto, como as rampas da Terra Brava. O salto não deve gastar cargas de empinar.
- Jogador e rivais obedecem às mesmas regras.

## Base existente e mudanças necessárias

Hoje `crashRider` reduz a velocidade para 17% e mantém um pequeno deslizamento, mas piloto e moto compartilham posição e temporizador; a remontagem é automática. Separar posição e velocidade da moto das do piloto e introduzir os estados pilotando → deslizando → levantando → a pé → remontando.

Proposta para o primeiro teste: direcionais e analógico controlam a caminhada; ao alcançar a moto, uma animação curta faz a remontagem. Câmera acompanha o piloto a pé e mostra onde ficou a moto. A moto precisa parar em local alcançável, inclusive junto de guard rails e barrancos.

Atropelamentos precisam de intervalo por impacto para evitar dano em cada frame e aprisionamento infinito sob um veículo. O salto aproveita a trajetória de `stunts.ts`, mas a moto caída vira um obstáculo móvel da simulação; não pode permitir saltos repetidos sobre o mesmo contato nem proteção contra outros veículos. A captura policial deve acompanhar a posição do piloto a pé, sem esperar a remontagem.

## Sequência de validação proposta

1. Protótipo individual isolado da publicação: deslizar, levantar, caminhar e remontar. Comparar quedas lentas/rápidas, todos os climas, estrada estreita, guard rail e barranco.
2. Acrescentar prisão, atropelamento, atraso/dano e salto sobre motos caídas. Conferir comportamento dos bots, colisões na aterrissagem, limite de tempo e desgaste no campeonato.
3. Validar teclado/celular, câmera, leitura visual e duração da recuperação com o usuário. **Aprovação de jogabilidade pendente; não publicar automaticamente.**
4. Adaptar a simulação autoritativa, previsão e snapshots do multiplayer. Testar dois clientes com latência, oito pilotos, reconexão e retomada do campeonato/conta. Campos novos do save exigem valores padrão e validação de checkpoints antigos. Mudança de física exige revisão do protocolo e da validação de replay/ranking antes da publicação aprovada.

A cena do policial na chegada é uma animação posterior ao resultado. Ela não implementa estes estados físicos nem substitui o protótipo de quedas.
