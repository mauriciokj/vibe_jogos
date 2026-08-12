# Auditoria da experiência inicial — base v1.22.0

Data: 07/08/2026

Esta auditoria registra a linha de base da v2. Foram observados menu, início, combate e progressão por três minutos simulados em desktop 1280×720 e celular 390×844. O teste curto oficial também executou aceleração, tiro e movimento lateral reais.

## Resultado geral

A versão atual é funcional, não apresentou erros de console e já contém bastante variedade. O problema principal é qualidade percebida: o jogo apresenta muitas regras antes de estabelecer com clareza e elegância o seu ciclo básico.

O primeiro trabalho da v2 deve ser reduzir carga cognitiva e melhorar a primeira missão. Adicionar outra mecânica agora diluiria ainda mais o foco.

## Bloqueadores de qualidade

### 1. Excesso de informação antes e durante o primeiro voo

- O menu mostra controles, ranking global, desafio diário, modos, links e objetivo ao mesmo tempo.
- HUD e informações da partida permanecem visíveis atrás do menu.
- Durante o voo, missão, câmera, ambiente, barrel roll e todos os atalhos ocupam permanentemente a parte inferior.
- No celular, seis botões utilitários disputam espaço com cinco controles principais.

Impacto: o jogador enxerga uma interface complexa antes de entender que a primeira tarefa é apenas pilotar, atirar e reabastecer.

### 2. Primeira falha acontece antes de o controle ser aprendido

- No teste curto, manter aceleração e usar movimento lateral por poucos instantes levou à margem.
- A velocidade sobe rapidamente enquanto a margem útil muda ao longo do rio.
- Não há uma fase inicial tolerante que ensine visualmente o limite navegável.

Impacto: a primeira morte pode parecer culpa do controle, não uma decisão do jogador.

### 3. Reabastecimento é ensinado por punição

- Um jogador que mantém o tiro pressionado destrói o primeiro FUEL e recebe `-250 PONTOS`.
- A instrução de sobrevoar o depósito aparece pequena, junto de várias outras informações.
- Não existe uma demonstração visual clara da diferença entre coletar e destruir.

Impacto: uma regra essencial é descoberta como erro antes de ser compreendida.

## Problemas de alto impacto

### 4. Visibilidade noturna

- Rio, margens, obstáculos e inimigos ficam excessivamente escuros em vários enquadramentos.
- O avião continua legível, mas ameaças sem holofote se misturam ao fundo.
- No celular, a área escura ocupa a maior parte da tela e reduz o tempo de reação.

### 5. Consistência visual

- Avião, helicóptero, navio e montanhas têm níveis diferentes de detalhe e proporção.
- Em baixa velocidade, a câmera aproxima demais o avião e suas asas dominam a tela.
- Há trechos visualmente vazios, seguidos por vários elementos e avisos simultâneos.
- Água, terreno e efeitos ainda usam formas que comunicam protótipo funcional, não acabamento final.

### 6. Hierarquia do HUD

- Velocidade é mostrada como um número arcade muito diferente da velocidade interna, sem contexto para o jogador.
- Informações permanentes e alertas temporários usam caixas visualmente semelhantes.
- O que exige ação imediata não se destaca o suficiente do que é apenas informativo.

## Acabamento

- Explosões, impactos e destruição de pontes precisam de mais peso e identidade.
- A transição entre momentos do dia é rápida quando o jogador destrói pontes em sequência.
- O som deve confirmar melhor acertos, perigos, combustível e mudança de objetivo.
- Ranking e desafio diário devem existir como conteúdo secundário, não competir com `DECOLAR`.

## Evidências técnicas

- Sessão automatizada de três minutos em desktop: nenhum erro de console.
- Sessão automatizada de três minutos em celular: nenhum erro de console.
- Capturas realizadas em 0, 30, 90 e 180 segundos nas duas proporções.
- O teste curto oficial chegou a `COLISÃO COM A MARGEM` depois de uma entrada lateral breve em alta velocidade.
- A medição em lotes de um segundo detectou picos quando grandes blocos da simulação criam e atualizam conteúdo. Ela não equivale a tempo de um quadro e será complementada por rastreamento em tempo real na fase de fluidez.

Artefatos locais:

- `output/web-game/river-v2-menu-baseline/`
- `output/web-game/river-v2-baseline/`
- `output/web-game/river-v2-audit/desktop-1280x720/`
- `output/web-game/river-v2-audit/mobile-390x844/`

## Primeira entrega implementada — v2.0.0-alpha.1

Tema: `Primeiro voo claro`.

1. Simplificar o menu principal para título, objetivo curto e `DECOLAR`.
2. Mover ranking e desafio diário para uma área secundária expansível.
3. Ocultar completamente o HUD de voo atrás do menu.
4. Criar orientação dentro da primeira missão, uma ação por vez:
   - mover;
   - acelerar/frear;
   - atirar;
   - sobrevoar FUEL;
   - destruir a ponte.
5. Tornar o primeiro depósito tutorial resistente a tiros e destacar a passagem por cima.
6. Esconder câmera, barrel roll e instruções avançadas até serem relevantes.
7. Reduzir a velocidade e aumentar a tolerância lateral durante os primeiros segundos da primeira partida.

Implementação local concluída em 07/08/2026. Os sete itens foram cobertos e o fluxo automatizado passou em desktop e celular sem erros de console. A próxima decisão depende do teste de uma pessoa jogando sem instruções externas; somente depois dessa validação a Fase 1 será considerada encerrada para publicação.

## Critério de aprovação da alpha.1

- A partida começa em um clique.
- Um novo jogador entende o próximo objetivo sem ler um manual.
- O primeiro FUEL ensina reabastecimento sem punir o jogador.
- Nenhuma instrução cobre uma ameaça ou controle.
- Desktop e celular mantêm apenas informações necessárias para a ação atual.
- Movimento, tiro, combustível, ponte, morte, reinício e partidas posteriores continuam funcionando.
