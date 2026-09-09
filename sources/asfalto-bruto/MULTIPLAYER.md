# Asfalto Bruto — multiplayer opcional

O modo individual continua local, com garagem, melhorias e progressão existentes. O botão **Multiplayer** abre salas online para **2–8 pessoas**. As melhorias de motor, resistência e dirigibilidade da campanha não entram no online: cada pessoa pode escolher qualquer um dos sete modelos antes de criar ou entrar numa sala. Cada moto começa com seus atributos de fábrica, sem melhorias e com integridade completa. O modelo escolhido aparece na sala e é preservado na reconexão. O equipamento de combate permanente, a joelheira comprada/equipada e o estoque de nitro da moto escolhida entram na sala; o nitro usado é descontado da garagem uma única vez, incluindo após reconectar. A chopper continua incompatível com apoio de joelho.

## Regras da sala

- A primeira pessoa cria a sala, escolhe uma das 20 opções combinadas, como **Costa do Sol · Dia** ou **Serra da Fumaça · Chuva**, e recebe um código/convite.
- A condição é fixa para toda a sala e aparece na espera, corrida e resultados. A previsão local usa a mesma aderência e frenagem de chuva do servidor; bots também antecipam as curvas.
- Porto Ferrugem está disponível nas quatro condições. Caminhões, cones e blocos pertencem à simulação comum; servidor, bots e previsão usam as mesmas regras. O passageiro decorativo acompanha um caminhão existente, não cria um obstáculo.
- A sereia da Costa é apenas cenário. O servidor sorteia local e ocorrência fora do gerador aleatório da física e compartilha o início da aparição. Reconectar não reinicia o evento.
- Ao criar, **Completar com bots** é opcional e vem desmarcado. Quando marcado, vagas livres são preenchidas por pilotos **CPU** somente na largada, até um total de 8. Todas as vagas continuam disponíveis para pessoas durante a espera. Bots não contam como prontos nem substituem o mínimo de 2 pessoas reais.
- O relógio começa em **60 segundos**. Entradas posteriores não prolongam a janela.
- É preciso ter **pelo menos 2 pessoas conectadas** na largada. Com apenas uma ao fim do tempo, a sala fica aguardando; a chegada da segunda abre uma nova janela de 60 segundos.
- Quando todos os presentes marcam **Pronto**, o tempo restante cai para **no máximo 5 segundos**. Uma pessoa sozinha não acelera a largada.
- Nos últimos 5 segundos, a entrada e a mudança de prontidão ficam fechadas. Se uma saída deixar menos de duas pessoas, a contagem é cancelada e volta à espera.
- Ao zerar o relógio, a corrida começa diretamente, sem outra contagem adicional.
- Polícia escolhe o piloto não eliminado mais próximo, humano ou bot. Queda a até 30m de um policial ativo causa prisão; a regra de captura parado também continua.
- Prisão, moto destruída, saída ou chegada são resultados individuais. Os demais continuam. Há limite de 6 minutos para encerrar participantes ainda na pista.
- Bots usam modelos variados e os respectivos atributos de fábrica, dirigem e freiam por IA no servidor e participam do combate e da classificação. Quando todos os humanos concluem ou são eliminados, a corrida encerra os bots restantes.
- CPUs com perfil veloz ou cauteloso e moto compatível recebem joelheiras e usam a manobra comum nas curvas secas. A cor progride conforme a dificuldade da pista. Choppers e polícia não apoiam o joelho; na chuva, os bots planejam a frenagem sem esse bônus. As motos online continuam com atributos de fábrica, e os equipamentos dos humanos seguem a seleção da garagem.
- As curvas exigem reduzir a velocidade para manter aderência. Mapa de proximidade (±300m) e retrovisor (200m atrás) usam posições da mesma simulação compartilhada.
- O menu de pausa online deixa a corrida continuar e neutraliza os controles locais. A pausa individual mantém o comportamento anterior.
- Na chuva, o servidor só derruba após mais de 2 segundos contínuos com o joelho apoiado, dentro da manobra de até 4s. O contador de contato faz parte do estado compartilhado; novo toque não reinicia e reconexão preserva. Tirar o joelho zera a contagem.
- Cada humano tem três ativações de empinada por corrida; reconectar preserva os usos restantes e o salto em andamento. Armas, alcance, dano, cadência e colisões são definidos pelo servidor, nunca por números enviados no carregamento de equipamentos.
- Reconexão reserva a identidade por 15 segundos; após perda prolongada, o piloto sai da corrida. Atualizar a página tenta retomar a mesma vaga usando um token de sessão.

Joelheiras, preços, nitro por modelo e os analógicos estão detalhados em [Equipamentos e controles](docs/equipamentos-controles.md).

## Desenvolvimento local

```sh
npm ci
npm run dev:server
# Em outro terminal:
npm run dev
```

Abra `http://127.0.0.1:4317/` em duas abas, escolha Multiplayer, crie uma sala e use o código na outra aba. A física roda no servidor em passos de 1/60 s; conexões recebem atualizações aproximadamente a cada 50ms. O Vite encaminha `/api/asfalto/` para o servidor em `4318`.

Em desenvolvimento, salas ficam em memória por padrão. Para testar armazenamento compartilhado:

```sh
ASFALTO_REDIS_URL=redis://127.0.0.1:6398 npm run dev:server
```

O navegador envia controles e sequências, nunca posição, vida ou resultados. O servidor limita valores e taxa de mensagens, rejeita sequências antigas e aplica um relógio próprio. O protocolo v11 inclui a condição da corrida, a aparição decorativa e o modelo validado de cada piloto e transmite o instante da simulação para desenhar todos os pilotos na mesma linha de tempo. As correções preservam a posição já desenhada e convergem gradualmente, com extrapolação limitada a 350ms. A classificação exibida vem do servidor. Ações de empinada, joelho, nitro, buzina e provocação usam fila com sequência e confirmação própria, para sobreviver a toques curtos e agrupamento de pacotes sem repetir consumo. Servidor e previsão compartilham a física dos equipamentos; IDs e estoque máximo são validados no servidor. Compras continuam no save local do navegador, sem conta ou carteira no servidor; o carregamento de equipamento não é uma comprovação autenticada de compra.

Toques de teclado e dos botões na tela geram ações numeradas, enviadas imediatamente e mantidas nos pacotes seguintes até a confirmação do servidor. Isso evita perder golpes curtos entre atualizações. O servidor respeita os intervalos entre golpes e executa cada ação apenas uma vez. Segurar o botão repete os golpes no intervalo permitido. A animação local começa imediatamente; acertos, danos, roubo de arma, prisão e resultados dependem da confirmação do servidor. Os eventos de impacto permanecem disponíveis por um segundo para chegar mesmo quando uma atualização é atrasada.

## Publicação atual na VPS

Produção está em `https://asfaltobruto.flowofdevelopment.com/asfalto-bruto/` e `https://flowofdevelopment.com/asfalto-bruto/`, atendidos pela mesma instância Node em `2.25.126.149`. Caddy termina HTTPS/WSS e encaminha ao serviço `vibe-asfalto`, com `ASFALTO_STORE=memory`. Não há operações Redis durante a corrida nessa instalação.

Use o checkout limpo da branch `codex/vps-centralizacao` de `mauriciokj/vibe_jogos`: exporte o jogo, confira o diff, registre/envie o commit e execute `npm run deploy:vps -- root@2.25.126.149` no catálogo. O deploy valida a release e recusa a troca durante corridas ativas. Veja `infra/vps/README.md` e `VALIDATION.md` no catálogo. O protocolo v11 requer atualizar as páginas; os saves individuais v1 permanecem válidos.

## Publicação alternativa no Vibe Jogos / Vercel (legado)

O catálogo existente é `mauriciokj/vibe_jogos`; a configuração abaixo documenta a hospedagem Vercel anterior. Prepare a integração em uma branch/worktree e execute:

```sh
npm run export:jogos -- "/caminho/do/worktree/Jogos"
```

O exportador gera `games/asfalto-bruto/`, o endpoint `api/asfalto.js`, o cartão no catálogo e os fontes em `sources/asfalto-bruto/`. Os fontes são excluídos da publicação estática por `.vercelignore`. Outros jogos e o leaderboard permanecem com seus arquivos e rotas existentes. O endereço do jogo será `/games/asfalto-bruto/`, com `/api/asfalto/` no mesmo domínio.

O endpoint usa WebSockets nativos das Vercel Functions, disponíveis em beta em setembro de 2026, e precisa de **Fluid Compute habilitado**. A função é configurada com duração máxima de 300 segundos; o cliente reconecta quando a conexão é encerrada pelo provedor.

A função `api/asfalto.js` é publicada em **São Paulo (`gru1`)**, próximo dos jogadores brasileiros e do banco usado neste catálogo. Essa configuração é específica do jogo. A medição da prévia revelou atualizações a cada ~500ms e confirmações de comando em ~590ms antes da mudança de região. Em São Paulo, a cadência voltou a ~50ms e a confirmação caiu para ~53ms na mesma medição com dois participantes. São amostras da rede de teste, não uma garantia para toda conexão.

As conexões podem cair em instâncias diferentes. Por isso, produção exige Redis compartilhado e nunca usa silenciosamente o armazenamento local. Variáveis de servidor aceitas:

| Conexão | Variáveis |
| --- | --- |
| Redis TCP/TLS | `ASFALTO_REDIS_URL`, `REDIS_URL` ou `KV_URL` |
| Redis REST / integração já usada pelo catálogo | `KV_REST_API_URL` + `KV_REST_API_TOKEN`, ou `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |

Configure as variáveis tanto em **Preview** quanto em **Production**. Nenhuma credencial é enviada ao navegador. As chaves ficam isoladas no prefixo `asfalto:online:v11`, com expiração de 30 minutos; o leaderboard existente não é acessado. O protocolo v11 exige atualizar as páginas e criar uma nova sala; salas v1/v2/v3/v4/v5/v6/v7/v8/v9/v10 não são migradas. Mutação com trava e verificação de posse impede que duas instâncias sobrescrevam a mesma sala. REST tem mais latência por operação que uma conexão Redis persistente: validar a região e a cadência em produção antes de ampliar o público.

Cada atualização usa duas operações Redis: a primeira adquire a trava, incorpora os controles mais recentes da instância e lê o estado; a segunda salva com verificação de posse e libera a trava. Isso evita quatro esperas sequenciais por atualização. Entradas continuam ordenadas por sequência e são compartilhadas entre instâncias. Alterações de direção, aceleração e freio são enviadas imediatamente, além dos pacotes periódicos.

Se o Redis não estiver configurado, a API retorna 503 e o cliente informa a indisponibilidade; o modo individual continua disponível. O endpoint HTTP permite verificar `multiplayer` e `sharedRooms`, sem retornar credenciais.

Fontes oficiais verificadas: [WebSockets no Vercel](https://vercel.com/docs/functions/websockets), [limites das Functions](https://vercel.com/docs/functions/limitations).

## Validação

```sh
npm test
npm run test:browser
npm run test:online
npm run test:motion
npm run test:tactics
npm run test:bikes
npm run test:conditions
npm run test:equipment
npm run test:stunts
npm run test:porto
ASFALTO_TEST_REDIS_URL=redis://127.0.0.1:6398 npm run test:redis
# Mede uma sala de teste na prévia publicada, com 8 conexões reais:
ASFALTO_BENCH_PLAYERS=8 ASFALTO_BENCH_OUTPUT=output/latency/eight.json npm run test:network
# Para medir um servidor local, acrescente ASFALTO_BENCH_URL=ws://127.0.0.1:4318/
```

Os testes online usam um servidor isolado, duas páginas e seis conexões adicionais, com relay que adiciona 100ms em cada direção. Cobrem salas, prontidão, largada, oito vagas, câmeras independentes, combate, roubo de arma, pausa online, reconexão, prisão individual, resultados e retorno ao modo individual. `test:motion` adiciona atraso variável de 65–170ms em cada sentido e 65ms no armazenamento; mede recuos e saltos de posição, testa direção em velocidade máxima e toques de 5ms para os três golpes, incluindo o botão na tela. Os testes Redis cobrem concorrência e duas instâncias. Artefatos visuais ficam em `output/online/` e `output/online-motion/`.

O protocolo ainda não oferece contas, ranking online persistente, matchmaking público ou compensação histórica de golpes. A validação com atraso não substitui testes em celulares físicos e redes móveis. A implantação pública deve ser verificada com pelo menos dois dispositivos externos, incluindo retomada de conexões no limite da função.

O benchmark registra intervalo entre estados, idade do estado ao sair do servidor, tempo até confirmar um comando, ping e tamanho das mensagens. Um teste visual pode ocultar uma baixa frequência de atualizações por causa da extrapolação; confira esses indicadores ao investigar lag.

### Guard-rails

As proteções desenhadas têm colisão: Costa do Sol e Porto Ferrugem à esquerda, Serra da Fumaça nos dois lados. A moto desliza pela proteção e perde velocidade sem queda ou dano causado pelo guard-rail. Laterais sem proteção continuam abertas. A mesma geometria limita simulação, previsão e interpolação de pilotos remotos; golpes e colisões laterais também não permitem atravessar. Esta alteração de física requer protocolo v10 e atualização das páginas.


### Personalização do capacete

`Loadout`, `MemberView` e `Rider` podem informar `helmetId` e `helmetColorId`. O servidor normaliza os dois por catálogos fixos; omissões/valores desconhecidos usam Integral branco. A seleção da garagem acompanha criar/entrar e a identidade já salva da sala acompanha retomar. Os campos são cosméticos e opcionais, mantendo o protocolo v10 e a física. Cada cliente desenha o mesmo capacete no piloto e no retrovisor; o save da garagem continua local ao navegador/origem.


## Terra Brava — protocolo v11

Pista rural com duas faixas, largada em duas colunas e até oito pilotos. Tratores, cascalho/lama e barrancos são autoritativos. Largura da estrada, atrito do solo, inclinação e contato com barrancos são compartilhados com a previsão. A interpolação remota respeita os limites do barranco na posição longitudinal apresentada; trechos abertos continuam livres. A colisão não causa queda/dano extra e soa como terra/pedras raspando.

Quatro condições e Saci/Boitatá usam o mesmo estado e relógio da sala, inclusive ao reconectar. Regras de prontidão, mínimo de dois humanos e preenchimento opcional por bots preservadas. Garagem/save v1 permanecem locais e compatíveis. Campos cosméticos introduzidos em v10 continuam disponíveis. Atualizar navegador e servidor juntos para v11; o deploy da VPS continua recusando ativação durante corridas ativas.
