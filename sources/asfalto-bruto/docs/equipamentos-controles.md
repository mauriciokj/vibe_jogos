# Equipamentos e controles

Implementação dos pedidos de setembro de 2026. A garagem tem seções Motos, Combate, Joelheiras e Nitro. A partida individual e o multiplayer opcional continuam disponíveis.

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
- **Na chuva, a queda acontece após mais de 3 segundos seguidos de joelho realmente apoiado**, inclusive durante a imunidade de recuperação. A manobra continua durando até 4s; ativá-la não derruba imediatamente. Tirar o joelho (reta, lado errado, baixa velocidade, acostamento ou chute) zera a contagem. Novos toques enquanto o apoio continua não zeram o tempo; pausa individual o congela e reconexão mantém o estado da simulação. A regra de prisão perto da polícia continua válida.
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

Protocolo v9: equipamentos limitados ao catálogo e à capacidade da moto; ações com sequência e ACK independentes dos golpes. O servidor controla a queda na chuva, o tempo de manobra, o nitro, a buzina e as falas. A previsão local reutiliza o movimento; nenhum novo serviço ou banco foi introduzido. Propriedade permanece no save local, conforme a garagem existente; não há autenticação de compras no servidor.

Testes específicos em `tests/equipment.test.ts` e `npm run test:equipment`, além dos testes anteriores de corrida/rede. A validação móvel usa eventos de toque nativos do Chromium, não substitui testes em todos os celulares físicos.


## Empinada e salto

- Dois toques distintos no acelerador em até 280ms (W/↑ ou duas deflexões do analógico direito do centro para cima), acima de 72 km/h e dentro da estrada.
- Três ativações por piloto/corrida. Cada ativação gasta um uso mesmo sem saltar e permite até 2,4s de empinada. Não acumula ativações. Nova corrida repõe três; pausar ou reconectar à mesma corrida preserva o contador.
- Salto automático ao se aproximar alinhado de um **carro na contramão**, com antecedência suficiente. Um salto por ativação, duração de 1s e arco de até 2,2m. Uma ativação tardia não impede a colisão.
- Apenas o carro que iniciou o salto é transposto, durante a altura suficiente. Outro carro, vans, caminhões, tráfego no mesmo sentido e obstáculos continuam sujeitos às colisões normais. Não há proteção geral contra colisões.
- Frear, reduzir abaixo de 72 km/h ou sair para o acostamento cancela a empinada; um salto iniciado segue até aterrissar. Queda ou eliminação cancela a manobra, sem devolver uso. A polícia continua prendendo quem cai perto dela.
- Funciona nas sete motos, inclusive chopper, e na chuva. A manobra de joelho não pode ser combinada com empinada/salto. Golpes não começam nem acertam pilotos enquanto estão no ar.
- O modelo de caminhão tem desenho e colisão preparados e validados em cenários de teste, mas ainda não foi incluído no tráfego das três pistas existentes. Sua introdução e o personagem decorativo pertencem ao Porto Ferrugem.

## Combate permanente

| Item | Preço | Dano | Alcance lateral | Intervalo entre golpes |
| --- | ---: | ---: | ---: | ---: |
| Garrafa | $650 | 24 | 2,7m | 0,50s |
| Bastão de beisebol | $1.500 | 38 | 3,4m | 0,78s |
| Corrente | $2.400 | 32 | 4,5m | 0,94s |

Compra/equipamento pela aba **Combate**. Use **L** ou o botão L no celular. A garrafa é rápida; o beisebol tem maior dano; a corrente tem maior alcance. Cada ataque tem preparação e pode errar se o alvo sair do alcance.

Os três são permanentes, inclusive a garrafa: não quebram, não são roubados e não se perdem em queda, prisão ou derrota. Reequipar um item comprado é gratuito. Usar o básico mantém as compras guardadas. O bastão básico continua gratuito, com 30 de dano, 3,6m de alcance e 0,72s de intervalo; pode ser tomado por soco. Quem já usa item permanente continua com ele ao tomar um bastão básico.

O item equipado acompanha a pessoa no online. O servidor aceita apenas IDs do catálogo e define o dano/cadência/alcance. Propriedade permanece no save local, como os demais equipamentos; saves v1 sem esse campo continuam válidos. Animações locais e remotas usam as mesmas durações de cada arma.
