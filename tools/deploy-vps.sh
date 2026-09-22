#!/bin/bash
# Деплой сайтов Betaline на base-vps (217.60.249.216). С 22.09.2026 все 4 сайта живут там,
# не на Vercel (Vercel-IP 76.76.21.21 частично блокируют в РФ). Использование:
#   tools/deploy-vps.sh custom2   # build-custom2.py → /srv/betaline/custom2
#   tools/deploy-vps.sh custom    # корень этого репо → /srv/betaline/custom
#   tools/deploy-vps.sh api       # api/ bot/ server.js → /srv/betaline/api (api.betaline-ai.ru, :8790)
#   tools/deploy-vps.sh apex      # betaline-landing (worktree betaline-master) → /srv/betaline/apex + apex-api (:8792)
#   tools/deploy-vps.sh zvonok    # betaline-voice-ai → /srv/betaline/zvonok + zvonok-api (:8791)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APEX=~/Documents/betaline/worktrees/betaline-master
ZVONOK=~/Documents/betaline/betaline-voice-ai
STATIC_X=(--exclude api --exclude bot --exclude "package*.json" --exclude vercel.json --exclude .vercel --exclude node_modules --exclude .git --exclude "*.md")

push_api() { # $1 = локальный каталог с api/ bot/, $2 = имя на сервере (api|apex-api|zvonok-api), $3 = systemd unit
  node --check "$ROOT/server.js"
  rsync -az --delete --exclude .env --exclude node_modules "$1/api" "$1/bot" "$1/package.json" "$1/package-lock.json" "$ROOT/server.js" "base-vps:/srv/betaline/$2/"
  ssh base-vps "cd /srv/betaline/$2 && npm install --omit=dev --no-audit --no-fund >/dev/null && systemctl restart $3 && sleep 1 && systemctl is-active $3"
}
check() { curl -s -o /dev/null -w "$1 %{http_code}\n" "$1"; }

case "${1:-}" in
  custom2) cd "$ROOT"; python3 tools/build-custom2.py; rsync -az --delete "${STATIC_X[@]}" dist-custom2/ base-vps:/srv/betaline/custom2/; check https://custom2.betaline-ai.ru/ ;;
  custom)  cd "$ROOT"; rsync -az --delete index.html style.css main.js ecosystem.js assets base-vps:/srv/betaline/custom/; check https://custom.betaline-ai.ru/ ;;
  api)     push_api "$ROOT" api betaline-api; curl -s -o /dev/null -w "api %{http_code}\n" -X OPTIONS https://api.betaline-ai.ru/api/lead ;;
  apex)    cd "$APEX"; rsync -az --delete --exclude-from=.vercelignore "${STATIC_X[@]}" --exclude "*.py" --exclude .github --exclude .claude --exclude docs --exclude research ./ base-vps:/srv/betaline/apex/
           push_api "$APEX" apex-api betaline-apex-api; check https://betaline-ai.ru/ ;;
  zvonok)  cd "$ZVONOK"; rsync -az --delete "${STATIC_X[@]}" --exclude tests --exclude test-results --exclude screenshots --exclude docs --exclude scripts ./ base-vps:/srv/betaline/zvonok/
           push_api "$ZVONOK" zvonok-api betaline-zvonok-api; check https://zvonok.betaline-ai.ru/ ;;
  *) echo "usage: $0 custom2|custom|api|apex|zvonok"; exit 1 ;;
esac
