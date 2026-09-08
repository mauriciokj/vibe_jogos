# Vibe Jogos na VPS

O catálogo e os jogos versionados neste repositório podem ser publicados juntos. O Asfalto Bruto usa um único processo Node.js, com salas e simulação em memória. O placar do Snake e do Rio de Aço usa SQLite local. Não há dependência de Upstash nesse ambiente.

## Endereços e estrutura

- VPS: `2.25.126.149`, Ubuntu 26.04, 1 vCPU e 4 GB de RAM.
- `asfaltobruto.flowofdevelopment.com` abre o Asfalto Bruto em `/asfalto-bruto/`.
- Catálogo inicial: `http://2.25.126.149/` ou `/catalogo/` no subdomínio.
- `flowofdevelopment.com/<jogo>/`: cada jogo possui uma rota curta, por exemplo `/river-raid-3d/` e `/snake-classic/`. A página inicial, seus assets, login e rotas restantes continuam no Firebase por proxy para `fir-d4471.web.app`, preservando o site atual e suas futuras publicações. O catálogo está em `/catalogo/`.
- `/srv/vibe-jogos/releases/<release>/public/`: apenas arquivos públicos. Código dos serviços fica em `services/`, fora da raiz web.
- `/srv/vibe-jogos/current`: link para a release ativa; `previous` guarda a anterior.
- `/etc/vibe-jogos/asfalto.env`: configuração do multiplayer, sem credenciais externas.
- `/var/lib/vibe-jogos/catalog/leaderboards.sqlite`: placares persistentes, separados das releases.
- `/var/backups/vibe-jogos/`: backups diários de SQLite e configuração, com retenção de 14 dias. São cópias no próprio servidor; não substituem uma cópia externa.

Caddy atende HTTP/HTTPS e encaminha `/api/asfalto/` para `127.0.0.1:4318` e `/api/leaderboard` para `127.0.0.1:4320`. Cada serviço roda com seu próprio usuário sem privilégios, com reinício automático. Apenas SSH e portas web ficam liberados no firewall.

## Publicar atualizações

Use esta branch em um checkout limpo. Requer Node 22.18+ e `npm ci`. Os arquivos em `games/` são as versões publicáveis dos jogos. Os fontes do Asfalto ficam em `sources/asfalto-bruto/`; quando alterados, rode o exportador documentado no projeto para atualizar o build estático antes de publicar.

```sh
npm ci
npm run test:vps
npm run build:vps
# Registre as mudanças em um commit e envie a branch ao GitHub.
npm run deploy:vps -- root@2.25.126.149
```

O comando monta uma release com manifesto do commit, arquivos públicos e dois serviços Node empacotados, envia por SSH, verifica a saúde e troca o link `current`. Ele recusa publicação enquanto houver uma corrida ativa. `ALLOW_ACTIVE_RACES=1 /usr/local/sbin/vibe-activate <release>` permite uma interrupção intencional na VPS. Reiniciar o processo multiplayer encerra suas salas; créditos e melhorias individuais continuam no navegador, por origem.

Para incluir outro jogo estático, adicione sua pasta em `games/<nome>/` e seu cartão no `index.html`. Serviços futuros devem receber usuário, porta interna e unidade systemd próprios. Não acrescente processos do Asfalto em paralelo com `ASFALTO_STORE=memory`: os participantes precisam compartilhar a mesma instância.

## Instalação inicial

Na VPS Ubuntu limpa, instale `nodejs`, `caddy`, `sqlite3`, `ca-certificates` e `ufw` pelo APT. Revise os hosts em `Caddyfile` e as origens em `asfalto.env`. Envie esta pasta e execute `bootstrap.sh` como root. A configuração mantém o acesso SSH existente. Depois execute `deploy:vps` a partir do checkout local.

Os registros A de `asfaltobruto`, `@` e `www` (ou CNAME de `www` para o domínio principal) precisam apontar para a VPS para que o Caddy emita e renove automaticamente o certificado HTTPS.

## Operação e recuperação

```sh
systemctl status vibe-asfalto vibe-catalog caddy
journalctl -u vibe-asfalto -u vibe-catalog --since '10 minutes ago'
curl -fsS http://127.0.0.1:4318/
curl -fsS http://127.0.0.1:4320/health
systemctl start vibe-backup
systemctl list-timers vibe-backup.timer
/usr/local/sbin/vibe-activate <release-anterior>
```

Para restaurar um placar, pare `vibe-catalog`, preserve o banco atual, restaure o backup SQLite com o proprietário `vibe-catalog` e reinicie o serviço. Use o comando `.backup` do SQLite para copiar um banco ativo; não copie apenas o arquivo principal durante escritas em WAL.

## Migração e limites

A consulta de migração encontrou o placar Snake vazio. O placar antigo do Rio de Aço está bloqueado pela cota do Upstash; seus registros permanecem no provedor antigo e não foram apagados. O novo placar fica disponível na VPS e a importação histórica depende de recuperar acesso aos registros antigos.

As bibliotecas Phaser 3.90.0 e Three.js 0.160.0 usadas por jogos antigos estão em `vendor/`, com licenças e integridade npm verificadas. `vendor.mjs` reproduz a coleta. A integração CrazyGames continua opcional para execução no portal. O endpoint legado de analytics Vercel retorna JavaScript vazio na VPS.
