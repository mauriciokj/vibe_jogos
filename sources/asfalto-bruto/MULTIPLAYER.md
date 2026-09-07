# Asfalto Bruto — multiplayer opcional

O modo individual continua local, com garagem, melhorias e progressão existentes. O botão **Multiplayer** abre salas online para **2–8 pessoas**. O online não usa nem modifica os créditos e melhorias da campanha: todas as motos começam como Ferro 500, sem melhorias e com integridade completa.

## Regras da sala

- A primeira pessoa cria a sala, escolhe uma das três estradas e recebe um código/convite.
- O relógio começa em **60 segundos**. Entradas posteriores não prolongam a janela.
- É preciso ter **pelo menos 2 pessoas conectadas** na largada. Com apenas uma ao fim do tempo, a sala fica aguardando; a chegada da segunda abre uma nova janela de 60 segundos.
- Quando todos os presentes marcam **Pronto**, o tempo restante cai para **no máximo 5 segundos**. Uma pessoa sozinha não acelera a largada.
- Nos últimos 5 segundos, a entrada e a mudança de prontidão ficam fechadas. Se uma saída deixar menos de duas pessoas, a contagem é cancelada e volta à espera.
- Ao zerar o relógio, a corrida começa diretamente, sem outra contagem adicional.
- Polícia escolhe o piloto não eliminado mais próximo, humano ou bot. Queda a até 30m de um policial ativo causa prisão; a regra de captura parado também continua.
- Prisão, moto destruída, saída ou chegada são resultados individuais. Os demais continuam. Há limite de 6 minutos para encerrar participantes ainda na pista.
- O menu de pausa online deixa a corrida continuar e neutraliza os controles locais. A pausa individual mantém o comportamento anterior.
- Reconexão reserva a identidade por 15 segundos; após perda prolongada, o piloto sai da corrida. Atualizar a página tenta retomar a mesma vaga usando um token de sessão.

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

O navegador envia controles e sequências, nunca posição, vida ou resultados. O servidor limita valores e taxa de mensagens, rejeita sequências antigas e aplica um relógio próprio. A previsão local usa apenas movimento; combate, danos, prisão e classificação são confirmados pelo servidor. O cliente interpola movimento e reconecta automaticamente.

## Publicação no Vibe Jogos / Vercel

O catálogo existente é `mauriciokj/vibe_jogos`; `main` é a branch de produção. Prepare a integração em uma branch/worktree e execute:

```sh
npm run export:jogos -- "/caminho/do/worktree/Jogos"
```

O exportador gera `games/asfalto-bruto/`, o endpoint `api/asfalto.js`, o cartão no catálogo e os fontes em `sources/asfalto-bruto/`. Os fontes são excluídos da publicação estática por `.vercelignore`. Outros jogos e o leaderboard permanecem com seus arquivos e rotas existentes. O endereço do jogo será `/games/asfalto-bruto/`, com `/api/asfalto/` no mesmo domínio.

O endpoint usa WebSockets nativos das Vercel Functions, disponíveis em beta em setembro de 2026, e precisa de **Fluid Compute habilitado**. A função é configurada com duração máxima de 300 segundos; o cliente reconecta quando a conexão é encerrada pelo provedor.

As conexões podem cair em instâncias diferentes. Por isso, produção exige Redis compartilhado e nunca usa silenciosamente o armazenamento local. Variáveis de servidor aceitas:

| Conexão | Variáveis |
| --- | --- |
| Redis TCP/TLS | `ASFALTO_REDIS_URL`, `REDIS_URL` ou `KV_URL` |
| Redis REST / integração já usada pelo catálogo | `KV_REST_API_URL` + `KV_REST_API_TOKEN`, ou `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |

Configure as variáveis tanto em **Preview** quanto em **Production**. Nenhuma credencial é enviada ao navegador. As chaves ficam isoladas no prefixo `asfalto:online:v1`, com expiração de 30 minutos; o leaderboard existente não é acessado. Mutação com trava e verificação de posse impede que duas instâncias sobrescrevam a mesma sala. REST tem mais latência por operação que uma conexão Redis persistente: validar a região e a cadência em produção antes de ampliar o público.

Se o Redis não estiver configurado, a API retorna 503 e o cliente informa a indisponibilidade; o modo individual continua disponível. O endpoint HTTP permite verificar `multiplayer` e `sharedRooms`, sem retornar credenciais.

Fontes oficiais verificadas: [WebSockets no Vercel](https://vercel.com/docs/functions/websockets), [limites das Functions](https://vercel.com/docs/functions/limitations).

## Validação

```sh
npm test
npm run test:browser
npm run test:online
ASFALTO_TEST_REDIS_URL=redis://127.0.0.1:6398 npm run test:redis
```

Os testes online usam um servidor isolado, duas páginas e seis conexões adicionais, com relay que adiciona 100ms em cada direção. Cobrem salas, prontidão, largada, oito vagas, câmeras independentes, combate, roubo de arma, pausa online, reconexão, prisão individual, resultados e retorno ao modo individual. Os testes Redis cobrem concorrência e duas instâncias. Artefatos visuais ficam em `output/online/`.

O protocolo ainda não oferece contas, ranking online persistente, matchmaking público ou compensação histórica de golpes. A validação com atraso não substitui testes em celulares físicos e redes móveis. A implantação pública deve ser verificada com pelo menos dois dispositivos externos, incluindo retomada de conexões no limite da função.
