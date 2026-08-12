# Plano de qualidade — Rio de Aço 3D v2

Iniciado em 07/08/2026 após a avaliação editorial da CrazyGames: `The overall quality of the game does not yet meet the expectations of our platform`.

## Objetivo

Transformar a versão atual, rica em mecânicas, em uma experiência que pareça finalizada desde o primeiro contato: rápida para começar, fácil de entender, fluida, visualmente coerente e agradável de ouvir.

A v2 não será medida pela quantidade de novidades. Ela será medida pela qualidade percebida nos primeiros três minutos e pela vontade do jogador de continuar.

## Regra de escopo

- Congelar temporariamente novos inimigos, equipamentos, biomas e sistemas.
- Preservar as mecânicas já aprovadas pelo jogador.
- Trabalhar em uma melhoria principal por vez e testar antes de avançar.
- Não reenviar à CrazyGames apenas por aumento de versão; a evolução precisa ser imediatamente visível.
- Manter a v1.22.0 disponível em produção como referência durante a construção da v2.

## Fase 0 — Linha de base

Status: concluída em 07/08/2026. Diagnóstico registrado em `AUDITORIA_V2.md`.

- Registrar a v1.22.0 publicada como referência anterior à reformulação.
- Auditar menu, primeira partida, primeira morte e reinício em desktop e celular.
- Capturar os momentos de 0–30 s, 30–90 s e 90–180 s.
- Listar textos, elementos de HUD e regras que disputam atenção.
- Medir quadros lentos quando inimigos, pontes e ambientes aparecem.
- Classificar os problemas em: bloqueador, alto impacto, acabamento e opcional.

Critério de saída: concluído. A primeira entrega será `v2.0.0-alpha.1 — Primeiro voo claro`.

## Fase 1 — Primeiros três minutos e onboarding

Status: `v2.0.0-alpha.1` concluída localmente em 07/08/2026 e pronta para validação do jogador antes de publicação.

- Fazer o jogador chegar ao voo em no máximo um clique.
- Ensinar movimento, velocidade e tiro dentro da própria partida, com indicações visuais curtas.
- Apresentar uma regra de cada vez; câmera, barrel roll e sistemas avançados aparecem somente quando relevantes.
- Definir objetivos curtos e visíveis: sobreviver, reabastecer e destruir a ponte.
- Simplificar o HUD da primeira rodada e revelar informações avançadas progressivamente.
- Melhorar a primeira morte e o reinício para que o jogador entenda imediatamente o que aconteceu.

Critério de saída: uma pessoa que nunca viu o jogo consegue iniciar, pilotar, atirar, reabastecer e compreender a ponte sem instrução externa.

Resultado da alpha.1:

- Menu e HUD inicial simplificados.
- Primeiro voo guiado em cinco ações, com opção de pular.
- FUEL tutorial protegido e destacado.
- Assistência temporária de velocidade e margem.
- Interface avançada revelada após a primeira ponte.
- Desktop e celular aprovados no teste automatizado sem erros de console.

## Fase 2 — Fluidez e resposta

- Eliminar criação cara de geometria, materiais e texturas durante a partida.
- Reutilizar inimigos, projéteis, explosões e partículas por meio de pools.
- Aquecer previamente efeitos e materiais antes de iniciar o voo.
- Definir limites por perfil gráfico para partículas, entidades, sombras e resolução interna.
- Medir latência dos controles e estabilidade na entrada de cada tipo de inimigo.

Metas iniciais:

- Desktop médio: 60 FPS estáveis, p95 de quadro abaixo de 20 ms após aquecimento.
- Celular intermediário: pelo menos 30 FPS estáveis, buscando 45 FPS.
- Nenhuma pausa perceptível quando um inimigo ou efeito aparece pela primeira vez.
- Nenhum erro de console em uma sessão automatizada de três minutos.

## Fase 3 — Direção visual

- Definir uma linguagem low-poly única para avião, inimigos, estruturas e cenários.
- Melhorar silhuetas e proporções de navios, helicópteros, tanques, pontes e caça.
- Revisar água, margens e terreno para reduzir aparência de blocos provisórios.
- Padronizar paleta, materiais, iluminação, neblina e efeitos entre os ambientes.
- Melhorar tiros, impactos, explosões, destroços, rastros e feedback de dano.
- Garantir que capa, screenshots e jogo real tenham o mesmo nível visual.

Critério de saída: qualquer captura sem o HUD ainda é reconhecível como Rio de Aço 3D e não parece uma cena provisória.

## Fase 4 — Áudio e sensação de impacto

- Criar uma mixagem estável para motor, tiros, explosões, alertas e música.
- Dar identidade sonora diferente a navio, helicóptero, tanque, míssil e ponte.
- Usar camadas musicais para perigo, perseguição e mudança de ambiente.
- Adicionar pequenos congelamentos visuais controlados, vibração e câmera somente nos impactos importantes.
- Validar que o jogo continue confortável com fones e alto-falante de celular.

Critério de saída: ações importantes são compreendidas pelo som mesmo sem olhar diretamente para o HUD.

## Fase 5 — Interface e dispositivos

- Reorganizar menu, HUD, alertas e controles móveis como um único sistema visual.
- Reduzir caixas de texto permanentes durante o voo.
- Garantir legibilidade em 16:9, telas baixas, celulares e áreas seguras.
- Validar teclado QWERTY/AZERTY, toque, pausa, som e tela cheia.
- Fazer o perfil gráfico automático escolher uma configuração segura antes do primeiro voo.

Critério de saída: nenhum elemento importante encobre o rio, o avião, uma ameaça ou os controles.

## Fase 6 — Validação externa e nova submissão

- Realizar testes com jogadores que não acompanharam o desenvolvimento.
- Observar sem explicar e registrar onde hesitam, morrem ou abandonam.
- Comparar início da v2 com a gravação da v1.22.0.
- Produzir novas capas, screenshots e vídeos somente depois de finalizar o jogo.
- Criar um novo pacote de portal e repetir toda a matriz técnica.
- Reenviar à CrazyGames apenas quando as melhorias forem visíveis nos primeiros 30 segundos.

## Ordem inicial de execução

1. Auditoria objetiva dos primeiros três minutos.
2. Onboarding dentro do voo e redução do HUD inicial.
3. Estabilidade de quadros e pré-aquecimento.
4. Passe visual dos elementos vistos na rodada 1.
5. Áudio e impacto da rodada 1.
6. Teste externo curto antes de reformar os ciclos avançados.

## Fora do escopo imediato

- Novos equipamentos além dos já implementados.
- Novos biomas, chefes ou inimigos.
- Steam, Android ou iPhone antes da validação da experiência principal.
- Novos formatos de anúncio antes de recuperar a qualidade e retenção.
