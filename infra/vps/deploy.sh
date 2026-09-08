#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
vps_target=${1:-root@2.25.126.149}
[[ "$vps_target" =~ ^[a-zA-Z0-9_.@:-]+$ ]] || { echo 'Destino SSH invalido';exit 2; }
if [[ -n "$(git status --porcelain)" ]]; then echo 'Registre as alteracoes em um commit antes de publicar.' >&2;exit 2;fi
npm run build:vps
release_id="$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short HEAD)"
ssh "$vps_target" "install -d -m 755 /srv/vibe-jogos/releases/$release_id"
COPYFILE_DISABLE=1 tar --no-xattrs -czf "output/$release_id.tar.gz" -C output/vps-release .
scp "output/$release_id.tar.gz" "$vps_target:/srv/vibe-jogos/releases/$release_id.tar.gz"
ssh "$vps_target" "tar -xzf /srv/vibe-jogos/releases/$release_id.tar.gz -C /srv/vibe-jogos/releases/$release_id && chmod -R a+rX /srv/vibe-jogos/releases/$release_id && /usr/local/sbin/vibe-activate $release_id"
