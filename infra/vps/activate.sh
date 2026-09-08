#!/usr/bin/env bash
set -euo pipefail
release_id=${1:?Informe o identificador da release}
[[ "$release_id" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 2
base=/srv/vibe-jogos
release="$base/releases/$release_id"
test -f "$release/public/index.html"
test -f "$release/services/asfalto.cjs"
test -f "$release/services/catalog.cjs"
if [[ "${ALLOW_ACTIVE_RACES:-0}" != 1 ]] && systemctl is-active --quiet vibe-asfalto; then
  active=$(curl -fsS http://127.0.0.1:4318/ | /usr/bin/node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>console.log(JSON.parse(s).activeRaces||0))')
  if ((active>0)); then echo "Ha $active corrida(s) ativa(s). Aguarde o termino antes de atualizar." >&2; exit 3; fi
fi
old=$(readlink -f "$base/current" || true)
ln -s "$release" "$base/current-next"
mv -Tf "$base/current-next" "$base/current"
systemctl restart vibe-asfalto vibe-catalog
healthy=0
for attempt in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:4318/ >/dev/null && curl -fsS http://127.0.0.1:4320/health >/dev/null; then healthy=1;break;fi
  sleep .5
done
if ((healthy==0)); then
  if [[ -n "$old" && -d "$old" ]]; then ln -s "$old" "$base/current-rollback";mv -Tf "$base/current-rollback" "$base/current";systemctl restart vibe-asfalto vibe-catalog;fi
  echo 'A nova release falhou. Veja os logs dos servicos.' >&2;exit 1
fi
if [[ -n "$old" && "$old" != "$release" ]]; then ln -sfn "$old" "$base/previous";fi
printf 'Release ativa: %s\n' "$release_id"
