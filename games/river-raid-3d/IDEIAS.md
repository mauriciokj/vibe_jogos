# Ideias de evolução — Rio de Aço 3D

Documento de referência para futuras atualizações do jogo.

## Prioridade recomendada

- [x] Aceleração e frenagem com inércia real.
- [x] Mudanças visuais e sonoras conforme a velocidade.
- [x] Lançadores de mísseis após o primeiro ciclo ambiental.
- [x] Alerta de travamento, mísseis telegrafados e possibilidade de abatê-los.
- [x] Modo de segurança no travamento e faróis capturados acompanhando o avião permanentemente.
- [x] Helicópteros progressivos e navios com holofote/canhão após três ciclos.
- [x] Bônus por evasão perfeita de mísseis.
- [x] Combo por destruições consecutivas.
- [x] Outros bônus por jogadas arriscadas.
- [x] Bifurcações que dividem o rio em dois canais e depois voltam a uni-lo.
- [ ] Ranking online com nome do jogador.
- [ ] Bioma desértico desbloqueado em um ciclo avançado.
- [ ] Bioma Jungle desbloqueado depois do Deserto.
- [ ] Eventos avançados: caça perseguidor, trem armado e tanques nas margens.

## 1. Lançadores de mísseis

Status: lançadores laterais, ativação após o primeiro ciclo, disparo básico, perseguição com curva limitada, evasão por velocidade e destruição preventiva concluídos. Alertas e combate contra mísseis em voo ficam para a próxima etapa.

- Começam a aparecer perto das pontes depois do primeiro ciclo completo de ambientes.
- Ficam instalados nas margens ou em pequenas ilhas defensivas.
- Mostram uma mira ou luz piscando antes de disparar.
- Os mísseis perseguem o avião, mas possuem velocidade e limite de curva definidos.
- O jogador pode destruir o lançador antes do disparo.
- Mísseis em voo podem ser abatidos com tiros.
- A quantidade, precisão e frequência aumentam a cada novo ciclo.
- Alguns lançadores podem proteger especificamente os pilares de uma ponte.

## 2. Velocidade com sensação realista

Status: aceleração, frenagem, inércia, velocidade real, câmera dinâmica, motor procedural, exaustão e rastros concluídos. Alterações de manobrabilidade continuam como expansão futura.

- Aceleração e frenagem graduais, com inércia do avião.
- A velocidade altera de verdade o deslocamento do cenário, inimigos, obstáculos e mísseis.
- A câmera abre o campo de visão ao acelerar e aproxima ao reduzir.
- O som do motor muda de frequência e intensidade.
- O avião vibra e produz um rastro mais intenso em alta velocidade.
- Curvas ficam mais pesadas em velocidade máxima.
- O consumo de combustível aumenta ao acelerar.
- Frear bruscamente pode fazer um míssil ultrapassar o avião.
- Acelerar pode ser necessário para escapar de um míssil próximo.
- Reduzir a velocidade melhora a precisão contra alvos terrestres.

## 3. Sistema de alerta de mísseis

Status: travamento telegrafado, aviso direcional, alarme progressivo, luz no Cockpit e abatimento de mísseis em voo concluídos.

- Indicador `LOCK` no HUD.
- Alarme sonoro crescente durante o travamento.
- Seta indicando de qual lado vem a ameaça.
- Luz vermelha piscando dentro do cockpit.
- Avisos diferentes para travamento, lançamento e impacto iminente.
- Pequeno marcador sobre cada míssil visível.

## 4. Manobras evasivas

- Duplo toque em esquerda ou direita executa uma esquiva rápida.
- Freada brusca pode enganar mísseis.
- Alta velocidade permite executar uma manobra de tonel.
- Manobras especiais gastam combustível e possuem recarga.
- Uma evasão feita no último instante concede pontuação extra.

## 5. Clima afetando a jogabilidade

Os novos biomas não aparecem desde o início. Cada ciclo completo possui um bioma principal e suas próprias variações de horário e clima.

- Neblina reduz a visibilidade do jogador e a precisão dos mísseis.
- Noite faz inimigos dependerem de faróis, holofotes e luzes de busca.
- Inverno deixa a resposta lateral do avião mais lenta.
- Entardecer cria reflexos no rio que dificultam identificar obstáculos.
- Faróis podem denunciar antecipadamente pontes e posições inimigas.
- Diferentes ambientes alteram velocidade do vento e consumo de combustível.
- Deserto transforma as margens em dunas e cânions, usa névoa de calor e reduz a quantidade de depósitos de combustível.
- Tempestades de areia no deserto diminuem temporariamente a visibilidade e destacam tiros, faróis e rastros.
- Jungle estreita trechos do rio, usa chuva tropical e permite que inimigos se escondam parcialmente entre árvores e ruínas.

### Progressão de biomas por ciclo

- Ciclo 1 — Vale Verde: Dia Claro, Entardecer, Noite, Neblina e Inverno, como no jogo atual.
- Ciclo 2 — Vale Verde em dificuldade maior: mantém o cenário conhecido enquanto introduz lançadores e novos padrões.
- Ciclo 3 — Deserto: Sol Forte, Entardecer, Noite Fria, Névoa de Calor e Tempestade de Areia.
- Ciclo 4 — Jungle: Dia Úmido, Entardecer, Noite Tropical, Neblina Baixa e Tempestade com Relâmpagos.
- Ciclo 5 em diante — biomas alternados ou combinados com defesas, inimigos e clima mais difíceis.
- A troca de bioma acontece somente ao completar o ciclo e destruir sua última ponte, nunca no meio da sequência.

## 6. Novos inimigos por ciclo

- Ciclo 1: navios e helicópteros comuns.
- Ciclo 2: lançadores de mísseis.
- Ciclo 3: barcos blindados, minas flutuantes e tanques nas margens.
- Ciclo 4: helicópteros armados, baterias antiaéreas e eventos com trem armado.
- Ciclo 5: caça perseguidor e pontes fortificadas.
- Ciclos seguintes combinam inimigos e padrões anteriores.
- Implementado: cada ponte destruída acelera os helicópteros em 6%; após o terceiro ciclo completo, navios próximos rastreiam o avião e disparam o canhão.

## 7. Combos e risco

Status: `EVASÃO PERFEITA`, combo por destruições, bônus de rasante, `PONTE NO LIMITE` e `TURBO SCORE` concluídos.

- Destruir inimigos consecutivamente aumenta um multiplicador. Implementado: janela de 4,5 s, multiplicador de ×1 a ×5 e barra regressiva no HUD.
- Voar próximo às margens gera bônus de rasante. Implementado: sustentar velocidade mínima 42 próximo à borda por 1,15 s concede 200 pontos uma vez por aproximação.
- Destruir uma ponte no último instante concede bônus. Implementado: destruir a até 16 unidades do avião concede 500 pontos extras.
- Escapar de um míssil por pouco gera uma `EVASÃO PERFEITA`. Implementado: passagem a até 4,8 unidades concede 350 pontos e encerra a perseguição.
- A velocidade máxima pode multiplicar a pontuação, mas aumenta o perigo. Implementado: a partir de 52 unidades/s, destruições valem ×1,5 e o bônus se combina com o multiplicador de combo.

## 8. Armas e equipamentos temporários

- Tiro duplo.
- Míssil ar-terra.
- Escudo para um impacto.
- Tanque extra de combustível.
- Chaff para confundir mísseis.
- Turbo com alto consumo de combustível.
- Radar temporário para neblina e noite.
- Canhão de disparo rápido com duração limitada.

## 9. Pontes especiais

- Ponte blindada com partes destrutíveis.
- Ponte ferroviária com um trem atravessando.
- Ponte defendida por lançadores nos dois lados.
- Ponte levadiça que abre e fecha.
- Ponte com navios patrulhando a entrada.
- A última ponte de cada ciclo funciona como uma pequena batalha de chefe.

## 10. Dano localizado

- Asa danificada reduz a mobilidade lateral.
- Motor danificado limita a velocidade máxima.
- Tanque atingido aumenta o consumo de combustível.
- Cockpit danificado interfere no HUD.
- Depósitos especiais ou o começo de um ciclo fazem reparos.
- Colisões graves continuam destruindo o avião imediatamente.

## 11. Rio dividido em dois canais

Inspirado nas bifurcações do River Raid original.

Status: estrutura procedural básica concluída. As bifurcações ficam bloqueadas na rodada 1. A partir da rodada 2, a primeira surge 320 unidades depois do desbloqueio, permanece por 280 unidades e os eventos seguintes se repetem a cada 1.800 unidades. As margens externas começam a se alargar antes de a ilha nascer. Diferenças de recompensa entre as rotas ficam para a próxima etapa.

- Depois de algum tempo, uma faixa de terra começa a surgir no centro do rio.
- Essa faixa cresce gradualmente até separar o rio em dois canais navegáveis.
- O jogador precisa escolher rapidamente o canal da esquerda ou da direita.
- Depois de uma determinada distância, a ilha central termina e os canais voltam a formar um único rio.
- A abertura e o reencontro dos canais devem ser graduais e fáceis de identificar.
- Implementado: aviso antecipado, colisão com a ilha, reaparecimento seguro, navios presos ao próprio canal e pontes somente fora da bifurcação.

### Escolhas de rota

- Um canal pode ter mais combustível e menos espaço para manobras.
- O outro pode ter mais inimigos e um multiplicador maior de pontuação.
- Pontes podem bloquear somente um canal.
- Lançadores podem defender um lado enquanto navios ocupam o outro.
- Minas e obstáculos podem obrigar o jogador a trocar de canal antes da separação completa.
- Algumas bifurcações podem esconder rotas bônus ou depósitos de reparo.

### Variações futuras

- Ilha central com montanhas, bases inimigas e faróis.
- Dois canais estreitos que se cruzam novamente perto de uma ponte.
- Canal sem saída sinalizado com antecedência.
- Três pequenas ilhas formando um zigue-zague.
- Escolha de rota influenciada pelo ambiente: gelo, neblina ou escuridão.

## 12. Áudio e impacto visual

- Motor muda conforme aceleração, dano e combustível.
- Mísseis produzem som direcional e deixam rastro de fumaça.
- Explosões de pontes possuem onda de choque e destroços maiores.
- Passagens rasantes geram deslocamento de água.
- Música ganha novas camadas a cada ciclo e durante travamentos de mísseis.

## 13. Ranking online

- Ao terminar a partida, o jogador pode informar um nome curto para registrar a pontuação.
- Mostrar ranking global, melhor pontuação pessoal e posição aproximada do jogador.
- Registrar também rodada alcançada, pontes destruídas, evasões perfeitas e data da partida.
- Permitir jogar sem cadastrar nome; nesse caso, a pontuação permanece apenas local.
- Limitar tamanho e caracteres do nome, filtrar termos inadequados e impedir HTML ou scripts.
- A pontuação deve ser validada pelo serviço do ranking para reduzir envios manipulados.
- A primeira versão pode mostrar os 20 melhores resultados e destacar a pontuação atual.

## 14. Ambiente desértico

Desbloqueio sugerido: início do terceiro ciclo completo; não aparece nas primeiras rodadas.

- O rio continua navegável, mas passa entre margens arenosas, dunas, cânions e formações rochosas secas.
- Paleta quente, céu esbranquiçado, névoa de calor e partículas de areia diferenciam o bioma.
- Depósitos FUEL aparecem com menor frequência, incentivando controle de velocidade e planejamento.
- Tanques, baterias antiaéreas e trens armados aparecem com mais frequência nesse ambiente.
- Variação futura: tempestade de areia que reduz a precisão de inimigos e do jogador.

## 15. Caça perseguidor

- Em um ciclo avançado, um caça inimigo surge atrás do jogador e inicia uma perseguição temporária.
- Ele acompanha mudanças laterais, tenta manter distância e dispara rajadas ou mísseis telegrafados.
- O objetivo principal é sobreviver até o caça perder combustível, abandonar a perseguição ou chegar a uma zona segura.
- Acelerar aumenta a distância, enquanto desacelerar ajuda a executar curvas e fazer os mísseis ultrapassarem.
- O jogador pode abater o caça com uma sequência difícil de disparos, recebendo um bônus maior.
- O evento deve ter aviso próprio no HUD, música de perseguição e duração limitada.

## 16. Trem armado

- Trilhos aparecem paralelos ao rio em determinados trechos, atravessando túneis e pontes ferroviárias.
- Um trem ocasional acompanha o avião por alguns segundos e dispara pelas laterais.
- Locomotiva, vagões de canhão e vagões de combustível podem ser alvos separados.
- Destruir um vagão de combustível causa uma explosão em cadeia, mas não reabastece o jogador.
- O trem precisa respeitar curvas e limites dos trilhos, desaparecendo em um túnel no fim do evento.
- No deserto, o trem armado pode ter maior frequência e visibilidade à distância.

## 17. Tanques nas margens

- Tanques patrulham estradas ou posições fortificadas fora do rio.
- A torre acompanha o avião apenas quando ele entra no alcance e mostra uma mira antes do disparo.
- Projéteis de tanque seguem trajetória visível e podem ser evitados acelerando ou mudando de lado.
- Alguns tanques protegem depósitos, pontes, lançadores ou entradas de bifurcações.
- Tanques comuns ficam parados; versões avançadas se movimentam paralelamente ao jogador.
- Destruir tanques em sequência contribui para o multiplicador de combo.

## 18. Ambiente Jungle

Desbloqueio sugerido: início do quarto ciclo completo, depois de o jogador atravessar o Deserto.

- Floresta tropical densa com árvores altas, cipós, pedras cobertas por musgo e ruínas antigas nas margens.
- O rio alterna entre áreas abertas e canais estreitos, exigindo mudanças de velocidade e decisões rápidas.
- Chuva tropical cria ondulações na água, reduz visibilidade e mascara parte do som dos inimigos.
- Helicópteros podem surgir atrás das copas das árvores e tanques usam clareiras como posições de emboscada.
- Holofotes e tiros revelam inimigos escondidos por alguns segundos durante noite, chuva e neblina.
- Troncos, pequenas ilhas e pontes de madeira funcionam como obstáculos característicos do bioma.
- Depósitos de combustível camuflados e ruínas bônus recompensam a exploração de canais mais perigosos.
- Variação futura: tempestade tropical com relâmpagos que iluminam brevemente o cenário inteiro.

## Ordem sugerida para a próxima grande atualização

1. Reestruturar aceleração, frenagem e sensação de velocidade.
2. Implementar lançadores, mísseis, alertas e evasão.
3. Criar a primeira bifurcação simples com dois canais equivalentes.
4. Adicionar recompensas diferentes para cada rota.
5. Adicionar tanques nas margens como primeiro inimigo terrestre móvel.
6. Criar o ciclo 3 no Deserto e integrar tanques e tempestades de areia.
7. Criar o ciclo 4 na Jungle com canais estreitos, chuva e emboscadas.
8. Implementar o trem armado como evento lateral temporário.
9. Implementar o caça perseguidor como evento de ciclo avançado.
10. Integrar bifurcações, biomas, clima e defesas de pontes.
11. Adicionar o ranking online após estabilizar pontuação, combos e progressão.
