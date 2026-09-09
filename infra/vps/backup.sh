#!/usr/bin/env bash
set -euo pipefail
umask 077
backup_dir=/var/backups/vibe-jogos
install -d -m 700 "$backup_dir"
backup_name="leaderboards-$(date -u +%Y%m%dT%H%M%SZ).sqlite"
sqlite3 /var/lib/vibe-jogos/catalog/leaderboards.sqlite ".backup '$backup_dir/$backup_name'"
sqlite3 "$backup_dir/$backup_name" 'PRAGMA integrity_check;' | grep -qx ok
if [[ -f /var/lib/vibe-jogos/asfalto/accounts.sqlite ]]; then
  account_backup="$backup_dir/accounts-$(date -u +%Y%m%dT%H%M%SZ).sqlite"
  sqlite3 /var/lib/vibe-jogos/asfalto/accounts.sqlite ".backup '$account_backup'"
  sqlite3 "$account_backup" 'PRAGMA integrity_check;' | grep -qx ok
fi
tar -czf "$backup_dir/config-$(date -u +%Y%m%d).tar.gz" -C / etc/vibe-jogos etc/caddy/Caddyfile etc/systemd/system/vibe-asfalto.service etc/systemd/system/vibe-catalog.service
find "$backup_dir" -maxdepth 1 -name 'leaderboards-*.sqlite' -mtime +14 -delete
find "$backup_dir" -maxdepth 1 -name 'accounts-*.sqlite' -mtime +14 -delete
find "$backup_dir" -maxdepth 1 -name 'config-*.tar.gz' -mtime +14 -delete
