#!/usr/bin/env bash
set -euo pipefail
[[ $(id -u) == 0 ]] || { echo 'Execute como root.';exit 1; }
cd "$(dirname "$0")"
for cmd in node caddy sqlite3 ufw; do command -v "$cmd" >/dev/null;done
for service_user in vibe-asfalto vibe-catalog; do
  if ! id "$service_user" >/dev/null 2>&1; then useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$service_user";fi
done
install -d -m 755 /srv/vibe-jogos/releases /etc/vibe-jogos /var/lib/vibe-jogos
install -d -m 700 -o vibe-catalog -g vibe-catalog /var/lib/vibe-jogos/catalog
install -d -m 700 /var/backups/vibe-jogos
if [[ -f /etc/caddy/Caddyfile ]]; then cp -p /etc/caddy/Caddyfile "/var/backups/vibe-jogos/Caddyfile-before-$(date -u +%Y%m%dT%H%M%SZ)";fi
install -m 600 asfalto.env /etc/vibe-jogos/asfalto.env
for file in vibe-asfalto.service vibe-catalog.service vibe-backup.service vibe-backup.timer; do install -m 644 "$file" "/etc/systemd/system/$file";done
install -m 755 activate.sh /usr/local/sbin/vibe-activate
install -m 755 backup.sh /usr/local/sbin/vibe-backup
caddy validate --config "$PWD/Caddyfile" --adapter caddyfile
install -m 644 Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable vibe-asfalto vibe-catalog caddy
systemctl enable --now vibe-backup.timer
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
systemctl reload caddy
