# Equipamentos e controles

Implementação dos pedidos de setembro de 2026. A garagem tem seções Motos, Joelheiras e Nitro. A partida individual e o multiplayer opcional continuam disponíveis.

## Joelheiras

Compra permanente; equipar uma já comprada não cobra novamente. O item acompanha o piloto entre motos, mas a Lobo 1200, estilo chopper, não pode apoiar o joelho nem receber o bônus.

| Cor | Preço | Aderência extra durante o apoio | Velocidade de curva extra aproximada |
|---|---:|---:|---:|
| Branca | $450 | 12% | 6% |
| Verde | $900 | 22% | 10% |
| Azul | $1.600 | 32% | 15% |
| Roxa | $2.600 | 42% | 19% |
| Dourada | $4.000 | 55% | 24% |

- Dois toques distintos em até 280ms para o mesmo lado ativam a manobra acima de 72 km/h. A/← para esquerda, D/→ para direita. Segurar a tecla não conta como dois toques.
- Dura até 4s; inverter a direção, reduzir abaixo do mínimo ou ir ao acostamento cancela. A animação e o bônus aparecem na curva do lado escolhido, aumentando suavemente com velocidade e curvatura. Retas, baixa velocidade e acostamento não recebem bônus.
- **Na chuva, tentar a manobra com uma moto compatível e a joelheira equipada causa queda**, inclusive durante a imunidade de recuperação. A regra de prisão perto da polícia continua válida.
- A agilidade original da moto continua sendo a base. Falcão e Agulha fazem curvas melhor que a Lobo; a joelheira aumenta a aderência apenas durante a técnica. A velocidade de referência segue a raiz quadrada da aderência, não o mesmo percentual de aumento. O aviso de curva considera a manobra enquanto ela está ativa.
- Manobra e cor são visíveis aos outros jogadores, inclusive no retrovisor. Socos e armas mantêm suas animações; a animação de chute tem prioridade sobre a perna apoiada.

## Nitro

Cada carga custa **$2.500**, dá **+10% de aceleração e velocidade máxima por 5s** e é consumida ao ativar. Não acumula dois bônus simultâneos. Queda cancela o efeito e não devolve a carga.

| Moto | Estoque máximo |
|---|---:|
| Ferro 500 | 2 |
| Falcão 450 | 2 |
| Estradeira 900 | 2 |
| Veneno 750 | 3 |
| Lobo 1200 | 3 |
| Agulha 600 | 3 |
| Brutal 1000 | 5 |

O estoque é separado por moto e começa em zero. Comprar para uma moto exige possuí-la. N ativa no teclado; no celular há um botão Nitro. Reiniciar ou abandonar não restaura cargas gastas. No online, o servidor confirma o uso e o navegador registra recibos por piloto para não descontar novamente ao receber snapshots repetidos ou reconectar. Saves anteriores continuam v1 e não recebem equipamentos gratuitos.

## Buzina, provocações e celular

- **B** buzina; intervalo mínimo de 1s. O som também é ouvido por pilotos próximos no online.
- **Q** sorteia uma das dez frases aprovadas. O balão acompanha a cabeça por 3s, com intervalo de 5s entre falas do jogador e sem repetição imediata. Rivais próximos falam ocasionalmente. É texto em balões, sem voz sintetizada.
- Frases: “Ninguém me pega!”, “Eu sou o melhor!”, “Come poeira!”, “Ficou pra trás!”, “Tá passeando?”, “Essa estrada é minha!”, “Quero ver acompanhar!”, “Hoje eu levo essa!”, “Sai da frente!” e “Só vai ver minha placa!”.
- Analógico esquerdo controla a direção. Duas deflexões rápidas do centro para o mesmo lado ativam a técnica de joelho. Analógico direito acelera para cima e freia para baixo, com intensidade proporcional.
- Direção e aceleração podem ser usadas simultaneamente com dois dedos. Soltar, cancelar o toque, pausar ou perder foco limpa os controles. Botões J/K/L e Nitro permanecem. B e Q não têm botões no celular.

## Rede e validação

Protocolo v6: equipamentos limitados ao catálogo e à capacidade da moto; ações com sequência e ACK independentes dos golpes. O servidor controla a queda na chuva, o tempo de manobra, o nitro, a buzina e as falas. A previsão local reutiliza o movimento; nenhum novo serviço ou banco foi introduzido. Propriedade permanece no save local, conforme a garagem existente; não há autenticação de compras no servidor.

Testes específicos em `tests/equipment.test.ts` e `npm run test:equipment`, além dos testes anteriores de corrida/rede. A validação móvel usa eventos de toque nativos do Chromium, não substitui testes em todos os celulares físicos.
