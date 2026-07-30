# Ideias de evolução — Rio de Aço 3D

Documento de referência para futuras atualizações do jogo.

## Prioridade recomendada

- [x] Aceleração e frenagem com inércia real.
- [ ] Mudanças visuais e sonoras conforme a velocidade.
- [ ] Lançadores de mísseis após o primeiro ciclo ambiental.
- [ ] Alerta de travamento, mísseis telegrafados e possibilidade de abatê-los.
- [ ] Bônus por evasões e jogadas arriscadas.
- [ ] Bifurcações que dividem o rio em dois canais e depois voltam a uni-lo.

## 1. Lançadores de mísseis

- Começam a aparecer perto das pontes depois do primeiro ciclo completo de ambientes.
- Ficam instalados nas margens ou em pequenas ilhas defensivas.
- Mostram uma mira ou luz piscando antes de disparar.
- Os mísseis perseguem o avião, mas possuem velocidade e limite de curva definidos.
- O jogador pode destruir o lançador antes do disparo.
- Mísseis em voo podem ser abatidos com tiros.
- A quantidade, precisão e frequência aumentam a cada novo ciclo.
- Alguns lançadores podem proteger especificamente os pilares de uma ponte.

## 2. Velocidade com sensação realista

Status: núcleo de aceleração, frenagem, inércia e velocidade real concluído. Efeitos de câmera, áudio e manobrabilidade continuam planejados para a próxima etapa.

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

- Neblina reduz a visibilidade do jogador e a precisão dos mísseis.
- Noite faz inimigos dependerem de faróis, holofotes e luzes de busca.
- Inverno deixa a resposta lateral do avião mais lenta.
- Entardecer cria reflexos no rio que dificultam identificar obstáculos.
- Faróis podem denunciar antecipadamente pontes e posições inimigas.
- Diferentes ambientes alteram velocidade do vento e consumo de combustível.

## 6. Novos inimigos por ciclo

- Ciclo 1: navios e helicópteros comuns.
- Ciclo 2: lançadores de mísseis.
- Ciclo 3: barcos blindados e minas flutuantes.
- Ciclo 4: helicópteros armados e baterias antiaéreas.
- Ciclo 5: caças inimigos e pontes fortificadas.
- Ciclos seguintes combinam inimigos e padrões anteriores.

## 7. Combos e risco

- Destruir inimigos consecutivamente aumenta um multiplicador.
- Voar próximo às margens gera bônus de rasante.
- Passar próximo ao facho de um farol concede pontos de risco.
- Destruir uma ponte no último instante concede bônus.
- Escapar de um míssil por pouco gera uma `EVASÃO PERFEITA`.
- A velocidade máxima pode multiplicar a pontuação, mas aumenta o perigo.

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

- Depois de algum tempo, uma faixa de terra começa a surgir no centro do rio.
- Essa faixa cresce gradualmente até separar o rio em dois canais navegáveis.
- O jogador precisa escolher rapidamente o canal da esquerda ou da direita.
- Depois de uma determinada distância, a ilha central termina e os canais voltam a formar um único rio.
- A abertura e o reencontro dos canais devem ser graduais e fáceis de identificar.

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

## Ordem sugerida para a próxima grande atualização

1. Reestruturar aceleração, frenagem e sensação de velocidade.
2. Implementar lançadores, mísseis, alertas e evasão.
3. Criar a primeira bifurcação simples com dois canais equivalentes.
4. Adicionar recompensas diferentes para cada rota.
5. Integrar bifurcações, clima e defesas de pontes.
