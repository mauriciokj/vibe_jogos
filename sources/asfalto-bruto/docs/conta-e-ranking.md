# Conta Google, progresso e ranking

O login é opcional. Convidados mantêm a campanha e o multiplayer existentes.

## Conta e migração

- Google Identity Services com botão oficial. O servidor valida assinatura RS256, audiência, emissor, emissão, expiração e nonce descartável. Guarda o `sub` do Google, um ID interno e apelido; não guarda e-mail, foto, nome real nem credencial Google.
- Sessão aleatória de 30 dias: hash no SQLite, cookie host-only HttpOnly/Secure/SameSite=Lax, token CSRF e validação de Origin nos POSTs. Os dois domínios usam a mesma base de contas; cada domínio pede seu próprio login.
- No primeiro acesso, escolher importar o save deste navegador ou começar do zero. A garagem de convidado permanece separada. Motos, dinheiro, equipamento permanente, cores, melhorias, consumíveis e pistas são normalizados pelo mesmo código da campanha.
- Uma revisão por salvamento evita sobrescrever progresso mais recente do outro aparelho. Alterações distintas concorrentes exigem escolher uma das garagens, sem somar créditos/nitro. Tentativas com resposta perdida reutilizam recibo idempotente.
- Cache local por conta, mudanças pendentes, retomada após recarregar/reconectar. Trocar conta ou sair não mistura garagens. A sincronização não altera o estado de uma corrida em andamento.
- A migração preserva saves antigos locais: não é uma economia inviolável contra alteração manual do navegador. Não afirmar que o saldo legado foi validado pelo servidor.

## Rankings

- Individual e multiplayer separados; filtros de pista, condição e melhor tempo/pontos. Uma linha por jogador; top 50 e posição do jogador conectado se estiver além do top 50.
- Pontos por chegada (1º a 8º): 25, 18, 15, 12, 10, 8, 6, 4. Somente corridas concluídas. O número de corridas é o de chegadas validadas naquela pista/condição/modalidade.
- Individual: largada cadastrada no servidor com seed e garagem da conta. Navegador registra comandos por tick. Ao chegar, o servidor reproduz a física compartilhada em lotes com yield, confirma chegada e tempo; não aceita um tempo declarado. Proteção de tempo real, tamanho de envio, 72.000 ticks, um replay por vez, posse da largada e expiração de 24h. Offline continua local; largadas sem cadastro não entram no ranking.
- Multiplayer: associação privada do membro à sessão autenticada, sem expor ID da conta/token no snapshot. Uma conta por sala. Grava cada chegada autoritativa uma vez. Jogadores convidados continuam participando normalmente, sem ranking permanente.
- Recordes antigos ficam pessoais. Equipamento/saldo migrado é aceito como propriedade legada; ranking verifica corrida e física, não comprova origem do saldo anterior.
- Pistas atuais usam regras3 (quedas com deslizamento, recuperação a pé e interação com pilotos/motos caídos). O Histórico permite consultar regras2 (antes das novas quedas) e regras1 (antes dos obstáculos). Resultados continuam na base e ficam separados para comparar corridas equivalentes.
- `RANK_RULES` versiona a classificação. Aumentar ao alterar física/balanceamento de forma incompatível. Corridas iniciadas em regras antigas não entram na nova classificação. A história continua no banco.
- Até três resultados individuais pendentes ficam no navegador da conta; envio retoma ao conectar/abrir o jogo. Replays maiores que o espaço disponível não podem ficar pendentes.

## Operação na VPS

- `ASFALTO_DB_PATH=/var/lib/vibe-jogos/asfalto/accounts.sqlite`, proprietário `vibe-asfalto`, diretório 700. SQLite WAL, sincronização FULL. Base fora das releases; redeploy não apaga progresso.
- `GOOGLE_CLIENT_ID` é público e só habilita o login quando preenchido. Nenhum segredo OAuth é necessário para esse fluxo.
- `ASFALTO_COOKIE_SECURE=false` somente em servidor local de desenvolvimento. Produção usa HTTPS/cookies Secure.
- Endpoints sob `/api/asfalto/account/`: session, login, logout, save, nickname, ranking, start, finish.
- Backup diário consistente por `sqlite3 .backup`, verificação de integridade, retenção local de 14 dias. Não há backup fora da VPS configurado.
- Não executar o bootstrap completo na VPS existente: preserva-se o arquivo de ambiente; instalar somente diretório, service atualizado e backup. Ativação deve respeitar a guarda de corridas em andamento.

## Configurar Google

Criar/reutilizar um cliente OAuth do tipo **Aplicativo da Web** no Google Auth Platform. Informar:

- Nome do app: Asfalto Bruto.
- Público externo, para jogadores fora da organização. O login básico Google (openid/email/profile) é uma exceção à restrição de usuários de teste. A publicação e a verificação de marca controlam a apresentação pública do nome/logotipo; conferir a configuração no painel.
- Origens JavaScript autorizadas: `https://asfaltobruto.flowofdevelopment.com` e `https://flowofdevelopment.com`. Adicionar `https://www.flowofdevelopment.com` se esse endereço for usado para jogar.
- Página inicial: `https://asfaltobruto.flowofdevelopment.com/asfalto-bruto/`.
- Privacidade: `https://asfaltobruto.flowofdevelopment.com/asfalto-bruto/privacidade.html`.
- Domínio autorizado: `flowofdevelopment.com`.
- Fluxo JavaScript com callback: não requer URI de redirecionamento.
- Enviar apenas o ID público terminado em `.apps.googleusercontent.com`; não enviar senha nem segredo.

Configurar o ID em `/etc/vibe-jogos/asfalto.env` e reiniciar `vibe-asfalto` quando não houver corrida ativa. Validar login real com Google no computador e no celular, importação de um progresso escolhido pelo dono, compra/sincronização e ranking após uma corrida concluída. Testes com verificador injetado cobrem integração, mas não substituem essa validação real.

Referências oficiais: [configuração Google](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [validação do token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [Google Identity Services](https://developers.google.com/identity/gsi/web/reference/js-reference).

Resultados individuais pendentes usam IndexedDB, sem disputar a pequena cota do localStorage da garagem. O cache de garagem inclui uma cópia de recuperação por aba para preservar alterações ainda não confirmadas quando outra aba usa a mesma conta.
