# Auditoria de publicação — Rio de Aço 3D

Revisão interna: 5 de agosto de 2026.

Este documento é um inventário técnico e de produto para reduzir riscos antes da submissão. Ele não substitui uma busca formal de marca nem aconselhamento jurídico.

## Resumo executivo

O jogo está tecnicamente pronto para gerar um pacote de teste no itch.io e concluiu os bloqueadores técnicos identificados para o Basic Launch do CrazyGames. O próximo trabalho concentra-se no pacote e nos materiais da página.

O pacote completo ocupa aproximadamente **1,1 MB**, muito abaixo dos limites atuais dos dois portais. A base não contém arquivos externos de arte, música, modelos, fontes ou efeitos sonoros.

## Inventário de autoria e dependências

### Nome e comunicação

- Nome visível atual: **Rio de Aço 3D**.
- O nome de terceiros que inspirou o projeto não aparece na interface pública do jogo.
- A rota de desenvolvimento e o identificador interno do ranking ainda usam `river-raid-3d`; não devem aparecer em título, descrição, tags, capas ou divulgação.
- Antes de uma campanha comercial, ainda é recomendada uma busca formal de disponibilidade de **Rio de Aço** e variações nas classes relevantes.

### Arte e interface

- Avião, rio, inimigos, pontes, ambientes, partículas e interface são construídos em código com primitivas do Three.js, Canvas e CSS.
- Não existem PNG, JPG, SVG, modelos 3D ou pacotes de assets dentro da pasta do jogo.
- A imagem de referência usada no desenvolvimento do layout móvel não integra o pacote final.
- Fonte usada: `Courier New`, fornecida pelo sistema do jogador; não há arquivo de fonte redistribuído.

### Áudio

- Motor, tiros, explosões, alertas e bônus são sintetizados em tempo real com Web Audio API.
- Não existem músicas, amostras, MP3, WAV ou bibliotecas externas de áudio no pacote.

### Código de terceiros

- Three.js r168, sob licença MIT.
- A cópia da licença está preservada em `vendor/THREE-LICENSE.txt` e deve acompanhar todo pacote distribuído.
- O restante da implementação do jogo fica concentrado no `index.html` e nos documentos próprios.

## Prontidão para itch.io

Status: **pronto para empacotamento de teste**.

- [x] Jogo HTML5 com `index.html` como entrada.
- [x] Dependências locais e caminhos relativos.
- [x] Layout responsivo e controles móveis.
- [x] Pacote muito abaixo de 500 MB e de 1.000 arquivos.
- [x] Ranking externo usa HTTPS e possui fallback local.
- [x] Política de privacidade e suporte incluídos.
- [ ] Criar ZIP limpo contendo somente jogo, páginas auxiliares, Three.js e licença.
- [ ] Criar capa, capturas, GIF/vídeo curto, descrição e instruções.
- [ ] Configurar como jogo HTML gratuito com doações opcionais.
- [ ] Testar o ZIP no modo de visualização do itch.io antes de publicar.

O itch.io exige ZIP com `index.html` na raiz para projetos com múltiplos arquivos e aceita pagamentos de jogos HTML5 como doações. Referências: [upload de jogos HTML5](https://itch.io/docs/creators/html5) e [preços e doações](https://itch.io/docs/creators/pricing).

## Prontidão para CrazyGames

Status: **base técnica pronta para empacotamento e materiais**.

- [x] Aproximadamente 1,1 MB, abaixo dos limites de 50 MB inicial e 20 MB para destaque móvel.
- [x] Teclado e toque; desktop e celular.
- [x] Primeiro gameplay exige somente um clique.
- [x] Pausa, áudio, eventos e adaptador de plataforma já centralizados.
- [x] Política de privacidade disponível sem pop-up bloqueador.
- [x] Adicionar inglês e usar inglês como fallback da plataforma (`v1.20.0`).
- [x] Ocultar/desativar o botão e atalho próprios de tela cheia no CrazyGames, que fornece esse recurso externamente (`v1.20.0`).
- [x] Validar legibilidade e controles na matriz oficial, de 800×450 a 1920×1080 (`v1.20.0`).
- [ ] Preparar três capas: paisagem, retrato e quadrada, além do vídeo de prévia solicitado.
- [ ] No Full Launch, conectar SDK v3, `gameplayStart`/`gameplayStop`, anúncios e comando externo de áudio.
- [ ] Usar o ambiente de preview do portal antes da submissão.

O Basic Launch permite SDK opcional e mantém anúncios desativados. Inglês é obrigatório e o botão próprio de tela cheia é proibido. Referências: [introdução e fases de lançamento](https://docs.crazygames.com/requirements/intro/), [requisitos técnicos](https://docs.crazygames.com/requirements/technical/), [requisitos de gameplay](https://docs.crazygames.com/requirements/gameplay/) e [capas](https://docs.crazygames.com/requirements/game-covers/).

## Política de anúncios compatível

Os dois formatos aprovados continuam válidos, com uma restrição de fluxo:

1. **Intersticial entre partidas:** solicitado após Game Over, em uma pausa natural, e concluído antes de começar a próxima missão.
2. **Vida extra opcional:** exibida somente fora do gameplay ativo, com escolha clara de assistir ou encerrar normalmente.
3. **Exclusividade no encerramento:** se a vida extra recompensada for oferecida naquele Game Over, não solicitar também o intersticial antes do reinício.
4. **Confirmação:** conceder a vida somente depois de `rewarded: true`; erro ou anúncio indisponível nunca concede recompensa nem prende a tela.
5. **Basic Launch:** não mostrar o botão de recompensa enquanto os anúncios estiverem desativados.

O portal controla a frequência dos intersticiais e exige jogo pausado, interface bloqueada e áudio silenciado durante o vídeo. Referências: [requisitos de anúncios](https://docs.crazygames.com/requirements/ads/), [vídeos e recompensas](https://docs.crazygames.com/sdk/video-ads/) e [ritmo de intersticiais](https://docs.crazygames.com/resources/midgame-ads-pacing/).

## Ordem recomendada

1. Gerar um ZIP limpo e validar que ele funciona isoladamente.
2. Coletar capturas, capas e vídeo usando o mesmo pacote aprovado.
3. Publicar primeiro uma página de teste no itch.io.
4. Submeter ao Basic Launch do CrazyGames sem anúncios reais.
5. Integrar SDK e os dois formatos de publicidade somente se o jogo avançar para Full Launch.
