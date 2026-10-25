#!/usr/bin/env bash
# Pull, build and restart. Run on the server from /opt/car-market as a user that can
# write there and use sudo for systemctl:   ./deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# The build inlines the Supabase URL/key, so load them first.
set -a; . /etc/car-market.env; set +a

git pull --ff-only
npm ci
npm run build:all
sudo systemctl restart car-market
sleep 1
curl -fsS http://127.0.0.1:"${PORT:-8787}"/healthz && echo " – healthy"
