# Estudo de plataformas e monetização — Rio de Aço 3D

Última revisão: 5 de agosto de 2026.

Este documento organiza as opções para publicar e monetizar o jogo, incluindo portais de jogos web, site próprio, Steam, Android e iPhone. Custos, regras e comissões mudam com frequência; os valores abaixo devem ser confirmados antes de cada lançamento.

## Recomendação executiva

Se a pergunta for **“qual plataforma devemos preparar primeiro para gerar receita?”**, a recomendação é **CrazyGames**.

Se a pergunta for **“onde podemos publicar mais rápido para validar interesse?”**, a resposta é **itch.io**, em paralelo ou poucos dias antes da submissão ao CrazyGames.

Ordem sugerida:

1. **itch.io** — página pública rápida, coleta de opiniões e doações opcionais.
2. **CrazyGames** — primeiro alvo real de monetização por anúncios.
3. **Poki** — depois de controles para celular, carregamento otimizado e métricas positivas.
4. **Android** — primeiro aplicativo nativo, se a audiência web demonstrar demanda móvel.
5. **GameDistribution** — ampliar a distribuição depois que a integração com portais estiver modularizada.
6. **Steam** — somente com um pacote de conteúdo que sustente uma compra premium.
7. **iPhone/iPad** — depois de validar a versão Android e justificar o custo anual e o trabalho de revisão.
8. **Anúncios no site próprio** — quando houver tráfego suficiente e aprovação do Google para H5 Games Ads.

O jogo deve continuar com uma base única em HTML/Three.js. Criamos adaptações por plataforma ao redor dela, em vez de manter versões completamente diferentes.

## Situação atual do jogo

### Pontos favoráveis

- O jogo já roda no navegador e está publicado na Vercel.
- O arquivo principal é leve para um jogo 3D e não depende de uma engine pesada.
- O formato arcade, as partidas rápidas e o ranking combinam bem com portais web.
- Há ambientes, progressão de dificuldade, eventos especiais e motivos para jogar novamente.
- O ranking online já cria uma base para competição e retenção.

### Pendências antes de distribuir em outras plataformas

- O pacote portátil, os controles móveis, a pausa segura, a configuração do ranking e as páginas legais já estão prontos.
- A interface de anúncios e eventos está pronta, mas nenhum SDK ou anúncio real foi ativado.
- Precisamos decidir o primeiro canal de teste e preparar sua página, imagens, descrição e pacote de submissão.
- Antes de telemetria ou publicidade personalizada, será necessário definir métricas, consentimento e regras específicas do parceiro escolhido.
- Convém realizar uma revisão de propriedade intelectual: nome, artes, sons, textos e divulgação devem ser originais e não sugerir associação oficial com marcas de terceiros.

## Comparativo das plataformas

| Plataforma | Modelo principal | Custo inicial conhecido | Trabalho técnico | Encaixe atual | Decisão |
| --- | --- | ---: | --- | --- | --- |
| itch.io | Doações e versão para download paga | Sem taxa de entrada | Baixo | Alto para validação | Publicar primeiro |
| CrazyGames | Participação em receita de anúncios | Sem taxa de entrada divulgada | Médio | Muito alto | Primeiro foco comercial |
| Poki | Participação em receita de anúncios | Sem taxa de entrada divulgada | Médio/alto | Alto após otimização móvel | Segunda candidatura web |
| GameDistribution | Participação em receita de anúncios | Sem taxa de entrada divulgada | Médio | Bom para alcance | Entrar após modularizar SDKs |
| Site próprio | H5 Games Ads, patrocínio e apoiadores | Hospedagem já existente | Médio | Baixo sem tráfego próprio | Adiar até crescer a audiência |
| Android | Anúncios, compra para remover anúncios e itens | US$ 25, uma vez, para Play Console | Alto | Bom após controles de toque | Primeiro app nativo |
| Steam | Compra premium | US$ 100 por produto no Steam Direct | Alto | Médio/baixo no formato atual | Adiar até ampliar o produto |
| iPhone/iPad | Anúncios, compra e itens | US$ 99 por ano no Apple Developer Program | Alto | Médio após validar Android | Entrar depois do Android |

Os custos da tabela não incluem impostos, arte de loja, tradução, testes, certificados ou eventuais serviços externos.

## Avaliação detalhada

### 1. itch.io — validação rápida

O itch.io aceita jogos HTML5 enviados como um único HTML ou arquivo ZIP. Podemos publicar uma página gratuitamente, permitir doações e observar comentários e comportamento dos jogadores.

Limitação importante: segundo a documentação da plataforma, um jogo executado diretamente como HTML5 pode aceitar doações, mas não ser vendido como acesso obrigatório. Para cobrar um preço fixo, seria necessário oferecer uma versão para download.

Uso recomendado:

- publicar uma versão web gratuita;
- ativar “pague quanto quiser” como apoio;
- apresentar controles, trailer curto, capturas e changelog;
- usar os comentários como pesquisa qualitativa;
- posteriormente oferecer uma edição para download, se houver procura.

Não é o melhor canal para anúncios ou grande descoberta orgânica, mas é o caminho mais simples para testar uma página de produto.

### 2. CrazyGames — primeira tentativa séria de receita

É o melhor encaixe imediato para o formato atual. O portal possui um estágio de **Basic Launch**, no qual o SDK é opcional e a monetização fica desativada, e um **Full Launch**, que exige o SDK e habilita participação em anúncios.

O jogo já está dentro dos limites gerais de tamanho informados pela plataforma, mas ainda precisamos:

- tornar a URL do ranking configurável;
- incluir Three.js e demais dependências no pacote;
- evitar qualquer anúncio durante o voo ativo;
- integrar eventos de carregamento, gameplay e anúncios no SDK;
- completar controles de toque e testar desempenho em aparelhos mais modestos;
- preparar ícone, capas, descrição e capturas originais.

Posições naturais para anúncio:

- intersticial após `Game Over` ou entre ciclos completos;
- anúncio recompensado para uma continuação limitada;
- nunca durante perseguição, ponte, míssil ou controle ativo do avião.

### 3. Poki — alto potencial, seleção mais exigente

O Poki informa trabalhar com uma seleção de desenvolvedores e recebe pedidos de acesso antecipado. Sua documentação enfatiza carregamento muito rápido, experiência móvel, entrada fácil no jogo e localização.

O portal recomenda pacotes especialmente compactos — idealmente cerca de 5 MB no carregamento inicial e 8 MB no total — e considera controles de toque essenciais. O jogo é pequeno o bastante para perseguirmos essa meta, mas precisa eliminar dependências externas e oferecer uma experiência móvel completa.

Recomendação: candidatar depois que tivermos resultados da versão web, uma boa taxa de retorno e uma apresentação móvel polida.

### 4. GameDistribution — alcance por uma rede maior

A plataforma distribui jogos HTML5 para uma rede de sites e monetiza por anúncios. Pode aumentar bastante o alcance sem negociarmos com cada portal separadamente.

O risco é perder algum controle sobre contexto, marca e relacionamento direto com o jogador. Antes de integrar, devemos criar uma camada única para provedores de anúncios e eventos. Assim, o jogo não fica acoplado ao SDK de uma empresa.

### 5. Site próprio — controle total, mas depende de audiência

Manter o jogo em `vibe-jogos.vercel.app` dá controle sobre marca, ranking, dados e futuras ofertas. O Google oferece H5 Games Ads com formatos intersticiais e recompensados, porém a participação depende de inscrição, conta AdSense aprovada e análise de elegibilidade.

Antes de anúncios próprios, devemos medir ao menos um período consistente de tráfego. Sem audiência, anúncios geram pouca receita e podem reduzir a retenção cedo demais.

O site próprio continua importante como endereço oficial, mesmo quando os jogadores chegam por outros portais.

## Vale a pena transformar em aplicativo?

### Android — sim, condicionado à validação web

É o melhor primeiro aplicativo. O Google Play cobra US$ 25 uma única vez para criar a conta de desenvolvedor. Contas pessoais novas também podem precisar cumprir requisitos de testes e verificação antes da publicação.

Podemos reaproveitar o jogo com **Capacitor**, empacotando HTML, CSS e JavaScript em um aplicativo. Isso reduz o retrabalho, mas não transforma automaticamente o jogo em uma boa experiência móvel.

O aplicativo Android só deve entrar em produção depois de ter:

- controles de toque confortáveis e personalizáveis;
- suporte a diferentes proporções de tela e recortes;
- recursos locais, sem depender do CDN do Three.js;
- pausa, retorno e recuperação de áudio corretos;
- desempenho estável em aparelhos intermediários e de entrada;
- política de privacidade e consentimento para anúncios;
- integração com AdMob, caso escolhamos anúncios;
- opção de remover anúncios por compra, se fizer sentido;
- proteção básica do ranking contra pontuações fraudulentas.

Modelo sugerido: gratuito, com anúncios somente em pausas naturais, mais uma compra única para remover anúncios. Itens cosméticos podem ser avaliados depois, sem vender vantagem competitiva.

### Steam — tecnicamente possível, comercialmente ainda cedo

É possível empacotar o jogo para Windows, macOS e Linux com **Electron** ou uma solução semelhante. O Steam Direct cobra US$ 100 por produto; a taxa pode ser recuperada depois que o produto alcança US$ 1.000 de receita bruta ajustada. A página “Em breve” deve ficar pública por pelo menos duas semanas antes do lançamento.

O principal problema não é técnico, mas de proposta de valor. Na Steam, o jogador esperará mais do que a mesma versão gratuita do navegador. Antes de cobrar, a edição precisa parecer um produto premium, por exemplo:

- campanha ou progressão permanente;
- desafios diários e modos extras;
- conquistas e suporte completo a controle;
- tabela global mais robusta e placares por modo;
- mais biomas, inimigos, chefes e variações de rota;
- configurações gráficas, áudio, acessibilidade e remapeamento;
- salvamento local/nuvem;
- trilha e apresentação de loja próprias;
- ausência de anúncios na versão paga.

Recomendação: criar uma página de interesse e medir procura antes de pagar a taxa. A Steam passa a valer a pena quando houver uma “edição completa”, e não apenas um empacotamento do site.

### iPhone e iPad — possível, depois do Android

O mesmo projeto Capacitor pode gerar uma base iOS. Porém, o Apple Developer Program custa US$ 99 por ano e a revisão exige que o aplicativo ofereça uma experiência completa, estável e suficientemente semelhante a um aplicativo — não apenas um site reempacotado.

A Apple informa comissão padrão de 30% para bens digitais, com 15% em programas e situações qualificadas, como o App Store Small Business Program. Essas condições devem ser conferidas quando formos publicar.

Além das pendências do Android, a versão iOS exige:

- testes reais em diferentes iPhones e iPads;
- comportamento correto de áudio, suspensão e gestos do sistema;
- configuração de privacidade e, quando aplicável, consentimento de rastreamento;
- tela de loja, capturas e metadados específicos;
- justificativa de valor que ultrapasse um simples WebView.

Recomendação: só iniciar depois que o Android provar retenção e receita suficientes para justificar a anuidade e a manutenção adicional.

## Pontuação interna de prioridade

As notas abaixo são uma estimativa nossa, não uma promessa das plataformas. Foram ponderados velocidade para testar, custo inicial, reaproveitamento técnico, capacidade de descoberta, monetização e aprendizado.

| Plataforma | Nota de prioridade (0–5) | Motivo principal |
| --- | ---: | --- |
| CrazyGames | 4,3 | Melhor equilíbrio entre adequação ao jogo, descoberta e anúncios |
| itch.io | 4,1 | Publicação imediata e aprendizado barato |
| Poki | 3,8 | Ótimo público, mas entrada e acabamento mais exigentes |
| GameDistribution | 3,4 | Bom alcance depois que a integração estiver preparada |
| Android | 3,3 | Grande oportunidade móvel, com trabalho relevante de UX e operação |
| Site próprio com anúncios | 2,9 | Controle alto, mas depende de tráfego próprio e aprovação |
| Steam | 2,7 | Bom potencial premium somente após expansão de conteúdo |
| iPhone/iPad | 2,5 | Viável, porém com custo anual e revisão mais exigente |

## Plano de execução

### Etapa 1 — tornar o jogo portátil

- [x] Baixar e servir Three.js junto com o jogo (`v1.12.1`).
- [x] Criar uma configuração central para URL da API e identificação da plataforma (`v1.12.1`).
- [x] Manter o ranking da Vercel no site oficial e definir fallback local quando um portal bloquear chamadas externas (`v1.11.0`–`v1.12.1`).
- [x] Criar uma interface única para anúncios, eventos de partida e pausa (`v1.19.0`).
- [x] Adicionar política de privacidade e página de suporte (`v1.19.0`).
- [ ] Fazer auditoria de nomes, marcas, imagens, músicas e sons.

### Etapa 2 — tornar o jogo realmente móvel

- [x] Criar controles de toque para direção, velocidade, tiro, câmera, pausa, barrel roll e flare, com dois layouts persistentes (`v1.13.0`–`v1.14.0`).
- [x] Permitir ajustar posição, tamanho e visibilidade dos controles, com preferências por orientação (`v1.15.0`–`v1.16.0`).
- [x] Testar em telas pequenas, grandes, com recorte e em diferentes densidades (`v1.18.0`).
- [x] Criar níveis gráficos automáticos para aparelhos mais lentos (`v1.17.0`).
- [x] Pausar ao perder foco e retomar sem saltos de tempo (`v1.14.1`).

### Etapa 3 — primeiro teste de mercado

- [ ] Publicar uma página gratuita no itch.io com doações opcionais.
- [ ] Preparar o pacote e os materiais para o Basic Launch do CrazyGames.
- [ ] Medir durante 30 dias: partidas, duração, retorno, mortes, FPS, aparelhos e origem.
- [ ] Entrevistar ou coletar comentários de jogadores sobre controles, dificuldade e vontade de voltar.

Indicadores internos para avançar — servem como referência, não como regras das lojas:

- duração média de sessão próxima ou superior a 8 minutos;
- retorno no dia seguinte próximo ou superior a 10%;
- menos de 1% de sessões com erro fatal;
- desempenho estável nos aparelhos que representam a maior parte da audiência;
- interesse claro em jogar no celular ou comprar uma edição ampliada.

### Etapa 4 — escolher a expansão

- Se o **portal web** responder melhor: integrar anúncios do CrazyGames e candidatar ao Poki.
- Se houver muito uso ou pedidos de **celular**: criar o piloto Android com Capacitor.
- Se houver intenção de compra e demanda por conteúdo: preparar o escopo da edição **Steam**.
- Se o Android provar a economia do produto: adaptar e publicar no **iPhone/iPad**.

## Política inicial de anúncios aprovada

- Intersticial somente entre partidas, após o Game Over e antes de reiniciar, com limite de frequência.
- Anúncio recompensado opcional para receber uma vida extra, concedida apenas após confirmação do provedor.
- Nenhum banner sobre a área de jogo e nenhuma interrupção durante voo, combate, perseguição ou travessia de ponte.
- Começar somente com esses dois formatos e avaliar retenção antes de criar qualquer novo ponto de publicidade.

## Decisão proposta para a próxima implementação

A **build portátil** está concluída. O próximo bloco deve preparar o primeiro teste de mercado:

1. revisar propriedade intelectual e posicionamento da marca;
2. montar página, imagens, descrição curta, instruções e pacote para itch.io;
3. preparar em paralelo os requisitos do Basic Launch do CrazyGames, ainda sem ativar anúncios reais;
4. definir as métricas mínimas para comparar retenção, desempenho e interesse dos jogadores.

Esse teste informa se o próximo investimento deve priorizar portais web, Android ou uma edição premium mais ampla.

## Fontes oficiais

### Portais web

- [CrazyGames — requisitos e etapas de lançamento](https://docs.crazygames.com/requirements/intro/)
- [CrazyGames — requisitos para anúncios](https://docs.crazygames.com/requirements/ads/)
- [CrazyGames — portal de desenvolvedores](https://developer.crazygames.com/)
- [Poki — candidatura de desenvolvedores](https://developers.poki.com/share)
- [Poki — guia para jogos e engines web](https://developers.poki.com/guide/web-game-engines)
- [Poki — acesso rápido e experiência móvel](https://developers.poki.com/guide/easy-access)
- [Poki — monetização](https://developers.poki.com/guide/monetization)
- [itch.io — publicação de jogos HTML5](https://itch.io/docs/creators/html5)
- [itch.io — pagamentos e participação configurável](https://itch.io/docs/creators/payments)
- [GameDistribution — parceria para desenvolvedores](https://gamedistribution.com/developers/partnership/)
- [Google — inscrição em H5 Games Ads](https://support.google.com/adsense/answer/1705831?hl=pt-BR)
- [Google — Ad Placement API para jogos H5](https://developers.google.com/ad-placement)

### Aplicativos e lojas

- [Google Play Console — criação da conta e taxa](https://support.google.com/googleplay/android-developer/answer/6112435?hl=pt-BR)
- [Google Play — taxas de serviço](https://support.google.com/googleplay/android-developer/answer/112622?hl=pt-BR)
- [Google AdMob — documentação](https://developers.google.com/admob)
- [Capacitor — documentação oficial](https://capacitorjs.com/docs)
- [Steam Direct — taxa e publicação](https://partner.steamgames.com/steamdirect/)
- [Steamworks — tipos de lançamento e período “Em breve”](https://partner.steamgames.com/doc/store/types?l=portuguese)
- [Electron — documentação e distribuição](https://www.electronjs.org/docs/latest/tutorial/application-distribution)
- [Apple Developer Program — inscrição](https://developer.apple.com/programs/enroll/)
- [Apple — benefícios, anuidade e comissões](https://developer.apple.com/programs/whats-included/)
- [Apple — App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- [Apple — diretrizes de revisão da App Store](https://developer.apple.com/app-store/review/guidelines/)
