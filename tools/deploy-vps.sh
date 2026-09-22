#!/bin/bash
# Деплой на base-vps (217.60.249.216) — с 22.09.2026 custom2 и api живут там, не на Vercel
# (Vercel-IP 76.76.21.21 частично блокируют в РФ). Использование:
#   tools/deploy-vps.sh custom2   # статика: build-custom2.py → /srv/betaline/custom2
#   tools/deploy-vps.sh api       # api/ bot/ server.js → /srv/betaline/api + restart betaline-api
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-}" in
  custom2)
    python3 tools/build-custom2.py
    rsync -az --delete --exclude api --exclude bot --exclude package.json --exclude vercel.json --exclude .vercel \
      dist-custom2/ base-vps:/srv/betaline/custom2/
    curl -s -o /dev/null -w "custom2 %{http_code}\n" https://custom2.betaline-ai.ru/ ;;
  api)
    node --check server.js
    rsync -az --delete --exclude .env --exclude node_modules api bot server.js package.json package-lock.json base-vps:/srv/betaline/api/
    ssh base-vps 'cd /srv/betaline/api && npm install --omit=dev --no-audit --no-fund >/dev/null && systemctl restart betaline-api && sleep 1 && systemctl is-active betaline-api'
    curl -s -o /dev/null -w "api %{http_code}\n" -X OPTIONS https://api.betaline-ai.ru/api/lead ;;
  *) echo "usage: $0 custom2|api"; exit 1 ;;
esac
