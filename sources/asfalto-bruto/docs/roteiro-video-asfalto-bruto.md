# Como construí o Asfalto Bruto — roteiro para vídeo

Roteiro em primeira pessoa para você adaptar à sua maneira de falar. Duração estimada: aproximadamente 25–30 minutos, contando as demonstrações; depende do ritmo e da edição. A base foi a implementação aprovada no commit `ddfdb19`. As seções de conta e segurança foram atualizadas para o beta 1.1.0, com economia confirmada pelo servidor e protocolo multiplayer 14.

Título sugerido: **Criei um jogo inspirado em Road Rash com IA — da física ao multiplayer online**

Texto curto para a capa: **DO PROMPT AO MULTIPLAYER**

## 1. Abrir mostrando o resultado

**Na tela:** cortes rápidos de uma curva com joelheira, um salto, uma queda com busca da moto e duas pessoas correndo online. Depois, o menu do jogo.

**Fala:**

“Esse é o Asfalto Bruto: um jogo de corrida e combate de motos que roda no navegador, no computador e no celular. Ele começou com uma vontade de recuperar aquela experiência de Road Rash: correr no trânsito, disputar posição no braço e fugir da polícia.

Hoje ele tem sete motos, cinco estradas com quatro condições cada, garagem, equipamentos, campeonato, multiplayer para até oito pessoas, login com Google e progresso entre dispositivos.

Eu fui desenvolvendo o projeto com a ajuda do Codex. Vou mostrar como ele funciona por dentro e como os testes foram mudando o jogo, desde a sensação de velocidade até a forma de salvar uma compra e sincronizar uma corrida.”

## 2. Como o projeto foi crescendo

**Na tela:** conversa inicial, primeiras capturas se você as tiver e cenas da versão atual. Use imagens antigas reais para qualquer comparação de antes e depois.

**Fala:**

“O ponto de partida foi uma referência de jogabilidade. A partir dela criamos uma identidade própria: o nome Asfalto Bruto, motos fictícias, pilotos, pistas e elementos visuais do projeto.

Primeiro veio o individual: acelerar, fazer curva, bater, cair e receber um resultado. Depois fui jogando e apontando problemas concretos. A moto estava rápida, mas parecia lenta. Quem abria vantagem quase não podia ser alcançado. Alguns golpes se perdiam no multiplayer. Uma mudança boa nas curvas tornou os adversários fáceis demais.

O processo foi esse: pedir uma mudança, implementar, jogar, observar e ajustar. A IA ajudou a escrever código, investigar problemas e preparar testes. As decisões de como o jogo deveria se comportar vieram dessa troca e da avaliação jogando.

A mecânica de cair e correr até a moto é um exemplo: ela ficou numa prévia separada, recebeu ajustes de animação e câmera, e só entrou no jogo público depois da minha aprovação.”

## 3. A tecnologia e o desenho da estrada

**Na tela:** `package.json`, `src/game/renderer.ts` e uma subida no jogo. Sobrepor a legenda: “TypeScript + Vite + Canvas 2D”.

**Fala:**

“O jogo foi escrito em TypeScript. O Vite prepara o ambiente de desenvolvimento e gera os arquivos que o navegador vai carregar. Os menus são HTML e CSS; a corrida é desenhada em Canvas 2D.

A aparência da estrada é construída com perspectiva, numa técnica que costuma ser chamada de 2.5D. Cada elemento tem uma posição no mundo. Quanto mais longe está da câmera, menor aparece e mais perto fica do horizonte. Ao se aproximar, cresce na tela.

A estrada é desenhada em trechos, acompanhando curvas e elevações. Árvores, carros, motos e construções são posicionados nesse mesmo espaço. O desenho também considera o que fica escondido atrás de uma subida.

Boa parte da arte é criada por código: formas, cores e poses viram pequenas imagens que ficam guardadas em cache para serem reutilizadas. O piloto caído recebeu uma geometria com volume e sombreamento, projetada nesse mesmo Canvas, para deixar de parecer uma imagem achatada.”

**Detalhe para conferir:** o corpo caído tem malha geométrica; isso não transforma o jogo inteiro em um motor 3D convencional. Não apresentar Unity, Unreal, Phaser ou Three.js como tecnologias deste jogo. Outros jogos do catálogo têm tecnologias diferentes.

## 4. A física: o que acontece entre dois desenhos

**Na tela:** acelerar, soltar o acelerador, frear e repetir uma curva em duas velocidades. Mostrar a constante `STEP = 1 / 60`.

**Fala:**

“A simulação e o desenho são separados. A simulação guarda a posição, a velocidade, a resistência do piloto, a integridade da moto e as ações em andamento. O desenho lê esse estado e mostra o resultado.

A física avança em passos fixos de um sessenta avos de segundo. Em cada passo, ela recebe os controles e calcula aceleração, frenagem, movimento, ataques e colisões. Isso ajuda a manter as regras consistentes e permite testar uma corrida sem precisar desenhar cada quadro.

A posição para os lados é representada por uma coordenada, e a distância percorrida pela estrada, por outra. A velocidade aumenta com o acelerador, diminui com freio e resistência ao movimento, e também depende do piso e dos danos.

É uma física arcade, ajustada para ser divertida e compreensível. Os números de velocidade representam a velocidade do jogo; não vêm de uma simulação mecânica completa de uma moto real.”

**Detalhe:** passo fixo de física não é garantia de 60 quadros desenhados por segundo em qualquer aparelho. O navegador usa `requestAnimationFrame` para desenhar.

## 5. Por que entrar rápido numa curva ficou difícil

**Na tela:** a mesma curva com Ferro, Falcão e Lobo; se possível, manter a velocidade inicial parecida.

**Fala:**

“Nas curvas entram três fatores principais: velocidade, intensidade da curva e agilidade da moto. A exigência da curva cresce com o quadrado da velocidade. Então aumentar a velocidade um pouco pode tornar a curva bem mais difícil.

Quando essa exigência supera a capacidade da moto, ela perde resposta lateral e é empurrada para fora. O jogo não freia automaticamente pelo jogador: eu preciso aliviar o acelerador, frear antes e acelerar na saída.

Isso resolveu uma limitação das primeiras corridas. Antes, quem saía na frente podia ficar acelerando sem muita decisão. Com curvas mais exigentes, passou a existir espaço para errar a entrada, escolher uma trajetória melhor e recuperar posições pilotando.

As motos têm diferenças reais nas regras. A Falcão é muito ágil, mas perde em velocidade final e resistência. A Lobo, estilo chopper, aguenta mais dano, mas pede antecipação nas curvas. A Brutal tem a maior velocidade final entre as motos da loja.”

**Nota técnica opcional:** `carga = velocidade² × intensidade da curva ÷ (3000 × agilidade efetiva)`. É a fórmula de balanceamento do jogo, não uma lei completa da dinâmica de motocicletas.

## 6. Velocidade medida e sensação de velocidade

**Na tela:** correr perto do acostamento; destacar faixas, refletores e vegetação passando.

**Fala:**

“Uma das coisas mais interessantes foi perceber que subir o número no velocímetro não resolvia a sensação de lentidão.

Também ajustamos a câmera, deixando-a mais próxima do asfalto, o campo de visão e os elementos que passam ao lado. Faixas mais curtas, refletores e vegetação próxima ajudam o olho a perceber o deslocamento. Entram ainda rastros, pneus animados, movimento da suspensão e vento nas bordas.

Existe, portanto, a velocidade que a física calcula e a forma como essa velocidade é apresentada. Trabalhar nas duas foi o que fez a corrida começar a parecer rápida.”

## 7. Garagem, equipamentos e economia

**Na tela:** passe pelos modelos na garagem, compare atributos e mostre equipamentos.

**Fala:**

“As sete motos têm velocidade, aceleração, agilidade e resistência próprias, além de estilos visuais diferentes. A garagem também permite melhorar motor, resistência e dirigibilidade.

Os preços foram ajustados porque estava fácil demais comprar outra moto. A primeira compra de moto começa em dez mil créditos e a mais cara custa cem mil. A ideia é dar valor à progressão.

Também existem armas permanentes, capacetes, joelheiras e nitro. As armas variam em dano, alcance e intervalo entre golpes. Os capacetes mudam a aparência. Já a joelheira ajuda na curva quando eu ativo a técnica com dois toques rápidos para o mesmo lado.

A manobra dura até quatro segundos, exige uma moto compatível e não funciona na chopper. Na chuva, mais de dois segundos contínuos de contato do joelho provocam a queda. Essa regra foi ajustada jogando: derrubar imediatamente estava estragando a experiência.

O nitro é consumível: uma carga custa dois mil e quinhentos créditos e aumenta aceleração e velocidade máxima em dez por cento durante cinco segundos. A capacidade varia entre duas, três e cinco cargas conforme a moto.”

**Detalhes para falar com precisão:** a joelheira dourada oferece até 55% de bônus de agilidade efetiva durante o apoio; isso corresponde a aproximadamente 25% na velocidade de referência da curva, não 55% na velocidade. Modelos de capacete são compráveis e cores são gratuitas. O bônus de recorde é pessoal: superar um tempo anterior paga 30% do prêmio anunciado da pista; a primeira chegada só estabelece o recorde.

## 8. Como funcionam os golpes e as colisões

**Na tela:** mostrar um soco, um chute, uma arma, colisão com carro e raspagem no guard rail.

**Fala:**

“Cada golpe tem preparação, momento de acerto, alcance e intervalo para poder ser repetido. A simulação confere se o adversário está perto o suficiente, inclusive na distância para a frente ou para trás e no lado do golpe.

O chute empurra mais. As armas têm características próprias. Um golpe só causa dano uma vez naquele ataque. Os rivais também têm um pequeno tempo extra de preparação para dar chance de reação.

As colisões usam limites simplificados dos veículos e obstáculos. Em velocidade alta, o código considera se os veículos passaram um pelo outro entre dois passos, para não deixar uma batida desaparecer porque a moto andou muito entre uma atualização e outra.

Piloto e moto têm barras separadas. Um golpe pode derrubar o piloto; uma colisão pode danificar a moto. Já o guard rail segura a passagem e reduz a velocidade, com som de raspagem, sem ser uma queda automática.”

## 9. Cinco estradas, vinte combinações

**Na tela:** seleção das pistas e um corte curto de cada ambiente.

**Fala:**

“Hoje são cinco estradas: Costa do Sol, Serra da Fumaça, Vale Vermelho, Porto Ferrugem e Terra Brava. Cada uma tem dia, entardecer, noite e chuva, formando vinte opções no menu.

Essas vinte opções reutilizam cinco traçados. A condição muda iluminação, cores e detalhes do ambiente. A chuva também muda a pilotagem: reduz a aderência e a força de frenagem. A condição é escolhida antes da largada e permanece durante a corrida.

Na Serra existem árvores caídas que ocupam três faixas, deixando uma rota de desvio. No Vale aparecem feno e tatus atravessando. No Porto temos obras e filas de carros parados em sentidos opostos. A Terra Brava tem duas faixas, tratores, barrancos, chão de terra, rampas e subidas que também influenciam a aceleração.

Além dos obstáculos, existem aparições decorativas. Tem sereia na Costa, o passageiro pendurado no caminhão do Porto e figuras do folclore na Terra Brava. Elas usam uma lógica separada da aleatoriedade da corrida. Assim, mudar um detalhe visual não troca o comportamento do trânsito.”

**Para conferir:** Serra e Vale ainda não têm os easter eggs de trem fantasma/OVNI sugeridos no planejamento. Macaco na mata também é ideia futura. Tatu é obstáculo com colisão; sereia é decoração. Não apresentar os dois como o mesmo tipo de evento.

## 10. Os outros pilotos e a polícia

**Na tela:** observar um rival freando, desviando e tentando atacar; mostrar o policial e o minimapa.

**Fala:**

“Os bots têm perfis de comportamento: agressivo, veloz e cauteloso. Eles observam o que está à frente, escolhem uma faixa, antecipam curvas, freiam e atacam quando alguém entra no alcance.

Eles produzem comandos como os do jogador e passam pela simulação do jogo. Alguns usam joelheira nas curvas secas. Na chuva, planejam a frenagem sem apoiar o joelho. Depois das quedas, também precisam buscar suas motos.

Essa inteligência é feita com regras no código. Não existe uma IA generativa recebendo perguntas durante a corrida.

O policial escolhe um piloto próximo, humano ou bot, e tem a maior velocidade máxima. Ainda precisa lidar com as curvas. Se ele chega perto de um piloto caído, pode prendê-lo. Na chegada, também existe uma cena em que ele estaciona, desce e distribui golpes entre os pilotos que já chegaram.”

**Detalhe:** a cena policial da chegada é apresentação; não altera o resultado já registrado nem prejudica quem continua disputando a corrida. Não há compensação automática de distância para teleportar ou acelerar rivais por estarem atrás.

## 11. Cair, deslizar e correr até a moto

**Na tela:** queda seca, queda na chuva, busca para trás e remontagem. Reservar esta parte para uma demonstração sem muitos cortes.

**Fala:**

“Essa foi uma das mudanças mais recentes. Na queda, a moto e o piloto passam a ter posições e velocidades separadas. Cada um desacelera até parar. A velocidade da batida, o tipo de queda, o piso e a chuva influenciam as distâncias.

Depois o piloto levanta e eu preciso correr até a moto. Posso ir para a frente, para trás e para os lados. Ao chegar perto, ele monta e volta à corrida.

Durante esse processo, os outros veículos podem me atropelar, causando dano e atrasando a recuperação. Uma moto caída de outro piloto também pode virar uma rampa para quem ainda está correndo. E a polícia continua sendo uma ameaça.

Se a moto chega a zero de integridade na queda, o jogo espera eu buscá-la. Quando tento pegá-la, ela explode e a corrida termina.

A câmera foi uma parte importante desse ajuste: ela segura o enquadramento enquanto piloto e moto deslizam para longe. Quando começo a correr, passa a acompanhar suavemente. Isso tirou aquele movimento brusco que atrapalhava entender onde eu e a moto tínhamos parado.”

**Complemento:** a empinada manual continua com três usos por corrida e permite saltar carros na contramão e árvores, nas condições previstas. Caminhões não são saltáveis pela empinada. Rampas da Terra e motos caídas acionam saltos automáticos sem gastar esses usos. O salto não dá imunidade geral contra tudo.

## 12. Sons, celular e leitura da corrida

**Na tela:** um salto com áudio, raspagem em metal, tela do celular, retrovisor e giroflex no mapa.

**Fala:**

“Os sons são sintetizados no navegador com a Web Audio API. O motor combina ondas e filtros; vento e impactos usam ruído e frequências diferentes. O timbre também muda para as motos custom.

Quando a moto salta sobre um carro, toca um impacto metálico e o motor sobe de giro enquanto a roda está no ar. Madeira e terra têm respostas sonoras próprias. Esses sons respondem ao estado do jogo.

No celular, os dois analógicos controlam direção e aceleração ou frenagem. A pé, os mesmos controles passam a servir para buscar a moto. Os botões de combate e nitro continuam separados.

O minimapa mostra quem está por perto e a distância para os outros pilotos, com o policial piscando como um giroflex. O retrovisor mostra os duzentos metros atrás. O objetivo desses elementos é permitir tomar decisões sem perder a leitura da estrada.”

## 13. Campeonato e linha de chegada

**Na tela:** card do troféu, classificação após uma corrida, bloqueio de reparo e celebração da chegada.

**Fala:**

“O campeonato cria uma sequência de vinte corridas, divididas em cinco etapas. Cada etapa usa uma estrada nas quatro condições. Os seis primeiros pontuam: dez, seis, quatro, três, dois e um. Quem não termina fica com zero.

Depois das quatro corridas, preciso estar entre os três primeiros para avançar. Os pontos são zerados para a próxima etapa. Se eu for eliminado, recomeço o campeonato, mas mantenho dinheiro e compras permanentes.

Também preciso administrar os danos. Dentro da etapa, a moto carrega o desgaste entre as corridas. O reparo normal fica entre as etapas, com uma exceção para a moto que chega a zero. Nesse caso, posso consertar antes da próxima corrida. Uma nova largada com a moto zerada fica bloqueada, e abaixo de vinte por cento aparece um aviso.

O campeonato guarda também a corrida em andamento. E, quando eu termino, os outros resultados são apurados continuando a simulação, em vez de inventar a colocação de quem ainda estava na pista.

Na chegada temos carros, torcida e comemoração. A câmera se afasta antes de apresentar as opções para continuar. Se eu ganhar, meu piloto comemora.”

## 14. Como duas pessoas enxergam a mesma corrida

**Na tela:** computador e celular lado a lado, criando uma sala e marcando Pronto. Depois, desenho simples do fluxo.

**Fala:**

“O multiplayer é opcional. O individual continua sendo calculado no navegador. Já na corrida online, o servidor mantém o estado oficial da partida.

Meu aparelho envia os controles: acelerar, frear, virar e atacar. O servidor calcula o movimento de todo mundo, os bots, as colisões e os resultados, e devolve o estado atualizado. Cada aparelho desenha esse mesmo mundo usando a câmera do seu piloto.

Para isso usamos WebSocket, uma conexão que fica aberta para os dados irem e voltarem durante a corrida. A física usa passos de sessenta atualizações por segundo, e o servidor trabalha com envios aproximadamente a cada cinquenta milissegundos, cerca de vinte por segundo, conforme a execução e a rede.

As salas têm até oito pessoas e precisam de pelo menos duas pessoas reais. Existe a opção de preencher as vagas com bots. Sala por convite espera sessenta segundos; pública espera cento e vinte. Quando todos estão prontos, o tempo cai para no máximo cinco segundos.

As partidas públicas aparecem numa lista, então também dá para entrar sem receber um código.”

**Detalhes:** no online é possível escolher qualquer um dos sete modelos com atributos de fábrica; melhorias de motor, resistência e dirigibilidade da campanha não entram. Arma permanente, joelheira e nitro selecionados acompanham o jogador. Bots só completam vagas na largada e não substituem o mínimo de duas pessoas. Pausar no online não pausa os adversários.

## 15. O que foi feito para melhorar o lag e os golpes

**Na tela:** gráfico simples de “comando → servidor → atualização”; se houver gravação antiga, mostrar o problema original.

**Fala:**

“Esperar a resposta do servidor para desenhar qualquer movimento deixa os controles pesados. Por isso o navegador faz uma previsão curta do movimento enquanto aguarda a confirmação.

Quando chega uma atualização, ele compara com o que já estava mostrando e suaviza a diferença. Também calcula o movimento provável dos outros pilotos por um intervalo pequeno. Essa previsão tem limite: se os dados param de chegar, o jogo não fica inventando a corrida indefinidamente.

Os golpes precisaram de outro cuidado. Um toque rápido podia acontecer entre dois envios e desaparecer. Agora as ações são numeradas, enviadas logo e repetidas nos pacotes seguintes até o servidor confirmar. O servidor reconhece o número e executa a ação uma única vez.

A animação começa localmente para responder ao toque. Quem confirma o acerto, o dano, a prisão e o resultado é o servidor.

Também existe reconexão para tentar recuperar o mesmo piloto, mantendo posição, danos e consumíveis. Isso melhora a resposta a oscilações, mas não elimina os efeitos de uma conexão ruim: a corrida continua no servidor.”

**Detalhes:** a previsão é limitada a 350 ms; aviso de sincronização após 750 ms sem avanço recebido; reconexão após 3 s sem avanço; janela de recuperação de 15 s. A volta a pé agora prevê separadamente corpo e moto. Isso não é compensação histórica de golpes nem arquitetura rollback.

## 16. A mudança de hospedagem

**Na tela:** esquema “navegador → HTTPS/WSS → VPS → serviço do jogo”. Mostrar o site público, evitando perder tempo com o painel do provedor.

**Fala:**

“No começo o multiplayer passou pela estrutura de Vercel e Redis/Upstash. Conforme fomos testando, apareceram problemas de latência e o limite de requisições do serviço de dados.

Depois centralizamos os jogos numa VPS. Hoje o Asfalto Bruto usa um processo Node.js para as partidas, com as salas na memória desse processo. Isso evita consultar um banco externo a cada atualização da corrida.

O Caddy recebe as conexões HTTPS e WebSocket seguro e encaminha para o serviço certo. Os arquivos do jogo também são entregues pela VPS. O processo é gerenciado pelo systemd, que mantém o serviço em execução.

Essa mudança reduziu dependências no caminho da partida, mas o navegador continua responsável por desenhar o jogo e a internet continua influenciando o multiplayer.

Os jogos e o catálogo ficaram centralizados. A página inicial que já existia continua vindo do Firebase por um proxy. O jogo em si e os dados do Asfalto estão na nova estrutura.”

**Detalhe:** as salas em memória não sobrevivem ao reinício do processo. Por isso o deploy recusa a ativação enquanto há corrida ativa. A arquitetura atual usa uma instância de simulação; não anunciar escalabilidade ilimitada, operação atual em Redis ou ausência garantida de lag.

## 17. Onde o progresso é salvo

**Na tela:** comprar ou equipar algo, recarregar a página e depois abrir a mesma conta em outro dispositivo. Espere “Garagem confirmada na conta” antes da troca. Esta explicação foi atualizada para o beta 1.1.0.

**Fala:**

“O jogo permite jogar como convidado. Nesse caso, dinheiro, motos e equipamentos ficam no armazenamento do navegador. Isso explica por que abrir outro navegador não mostrava a joelheira que eu já tinha comprado: era outro armazenamento local.

Para levar a garagem do computador para o celular, adicionamos login com Google. O Google confirma a identidade; o progresso fica no banco do próprio jogo, um SQLite na VPS.

No começo do beta, a sincronização aceitava uma cópia completa da garagem. Ao preparar este vídeo, percebi a brecha: era possível editar dinheiro e equipamentos no armazenamento do navegador e mandar sincronizar.

Corrigimos isso fazendo o servidor cuidar da economia. Agora o navegador pede para comprar uma moto, e o servidor confere o saldo, calcula o preço e entrega a garagem atualizada. Prêmios vêm de corridas que ele conferiu. A base das contas do beta foi preservada; contas novas começam com uma garagem oficial, e o progresso de convidado fica separado.

Cada operação tem uma revisão e um identificador. Isso evita comprar em cima de dados antigos e impede que uma repetição causada por falha de internet cobre ou premie duas vezes. O localStorage continua existindo como cópia, mas deixou de ser a autoridade da conta.”

**Detalhes:** conta é opcional e progresso de convidado fica separado. A mesma conta Google acessa a mesma base pelos dois domínios, mas cada domínio mantém sua própria sessão. Sincronização depende de autenticação/conexão; fechar a página antes da confirmação não prova que a alteração já chegou ao outro aparelho. O jogo não guarda senha Google nem usa Google Drive para os saves.

## 18. Como o ranking valida as corridas

**Na tela:** ranking individual, multiplayer, filtro de pista/condição e histórico. Mostrar um pequeno exemplo de comandos gravados.

**Fala:**

“O ranking permanente tem classificações separadas para individual e multiplayer, com filtros por estrada, condição e melhor tempo ou pontos.

No multiplayer, o servidor já está calculando a corrida. Ele registra a chegada oficial do jogador que está conectado à conta.

No individual existe uma solução diferente. Antes da largada válida para ranking, o servidor registra as condições iniciais, incluindo a moto e a semente da corrida. O navegador grava os comandos usados ao longo da partida.

Ao terminar, esses comandos são enviados e o servidor executa novamente a simulação. Ele confirma se aquela sequência realmente chega ao final e calcula o tempo. Não basta mandar um número dizendo que terminei em um minuto.

Isso funciona porque a física pode reproduzir os mesmos resultados com o mesmo estado inicial e os mesmos comandos. O replay aqui é uma sequência de entradas, não uma gravação de vídeo.

Quando uma mudança altera bastante as regras, criamos uma nova versão de ranking. Os resultados anteriores permanecem no histórico. Assim, os tempos das novas quedas não se misturam com os tempos da física anterior.”

**Detalhes:** campeonato não envia resultados ao ranking de corrida livre. Os pontos do ranking permanente são 25/18/15/12/10/8/6/4 e não os 10/6/4/3/2/1 do campeonato. No beta 1.1.0, o servidor também confirma a economia e o campeonato a partir de operações e comandos. Isso fecha a edição direta de dinheiro no save; não impede toda automação ou assistência na pilotagem. Não dizer “impossível trapacear”.

## 19. Visitantes, testes e publicação

**Na tela:** contador do menu, alguns testes e o diagrama de publicação. Evitar depender da leitura de um terminal inteiro.

**Fala:**

“Adicionamos também um contador de visitantes no menu. Ele usa um identificador anônimo no navegador para que recarregar a página não conte outra visita. É uma estimativa de navegadores únicos desde a ativação do contador; uma pessoa usando outro navegador pode aparecer de novo.

Para validar o jogo, usamos testes de regras e testes no navegador. Tem verificação de compras, pontos, colisões, chuva, reconexão, salvamento e replay. Nos testes de multiplayer, também simulamos atraso de rede e conectamos duas pessoas com seis bots.

O jogo tem recursos de teste para avançar o tempo de forma controlada, restaurar situações e conferir o estado da simulação junto com a imagem. Isso ajuda a repetir uma batida ou uma queda sem precisar correr a pista toda.

A publicação gera uma versão identificada pelo commit do GitHub. Ela é enviada para a VPS, os serviços são verificados e a versão anterior fica disponível para retorno. Os bancos ficam fora das pastas de publicação, então atualizar o jogo não apaga as contas e a garagem.

Também existem backups diários no servidor. E toda mudança importante continua precisando de avaliação jogando, porque passar num teste automatizado não significa, sozinho, que a mecânica ficou divertida.”

**Evidência da última entrega:** suíte completa com 173 casos; depois, um caso novo de replay e revalidação de 19 casos de contas/campeonato/replay, todos aprovados — 174 casos no conjunto final. Mais 9 testes da VPS. Browser local e HTTPS público aprovados. Os backups automáticos são locais à própria VPS, com retenção de 14 dias; não há cópia externa automática configurada. Não apresentar isso como benchmark de capacidade ou teste de todos os celulares.

## 20. Fechamento

**Na tela:** trecho de uma corrida real e o endereço público.

**Fala:**

“O que começou como uma ideia inspirada num jogo da minha infância virou um projeto com física, desenho, som, progressão, autenticação e comunicação em tempo real.

A parte mais interessante foi ver como uma mudança puxa a outra. A joelheira melhorou as curvas, então precisamos rever a dificuldade dos rivais. A queda ficou mais completa, então precisou funcionar também na câmera, no multiplayer, no campeonato e nos replays do ranking.

O projeto cresceu com código, testes e feedback de verdade. E dá para continuar evoluindo. Vou deixar o link para vocês jogarem e me contarem qual pista ou mecânica deveria vir depois.”

Link: https://asfaltobruto.flowofdevelopment.com/asfalto-bruto/

## Ordem prática para gravar as demonstrações

1. Menu, vinte opções, garagem e atributos das motos.
2. Uma mesma curva em duas velocidades e depois com motos diferentes.
3. Joelho no seco, joelho na chuva e busca da moto para trás.
4. Golpes, empinada/salto com áudio e raspagem no guard rail.
5. Um trecho de cada estrada; gravar aparições raras separadamente se conseguir encontrá-las.
6. Card e tabela do campeonato, continuidade de dano e chegada com comemoração.
7. Computador e celular na mesma sala; criação, Pronto, largada e combate.
8. Conta, garagem sincronizada e ranking. Para comprovar progresso entre dispositivos, use seu fluxo real de login e aguarde confirmação da sincronização.
9. Contador do menu e alguns exemplos de testes.
10. Abertura e encerramento falando para a câmera, depois de ter as cenas de apoio.

Para cenas raras, o laboratório local permite preparar situações. Identifique-as como demonstrações de teste quando estiver explicando validação. A aba da porta 4390 é a prévia isolada; contas e multiplayer devem ser demonstrados no site publicado.

Para detalhes, referências de código, critérios de validação e limites, consulte `ficha-tecnica-asfalto-bruto.md` nesta pasta.
