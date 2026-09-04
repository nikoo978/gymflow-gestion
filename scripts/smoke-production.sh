#!/usr/bin/env bash
set -euo pipefail

base="${1:-${PUBLIC_APP_URL:-}}"
if [[ -z "$base" ]]; then
  echo "Uso: $0 https://gymflow.example.com" >&2
  exit 2
fi
base="${base%/}"

printf 'Smoke GymFlow: %s\n' "$base"
health="$(curl -fsS --max-time 15 "$base/api/health")"
printf '%s' "$health" | grep -q '"ok":true'
curl -fsS --max-time 15 "$base/" | grep -q 'Infytter Fitness'
curl -fsS --max-time 15 "$base/pantalla-acceso" | grep -q 'Infytter Fitness'

# Verifica que una ruta SPA inexistente no sea convertida en 404 por el proxy.
code="$(curl -sS -o /tmp/gymflow-spa-smoke.html -w '%{http_code}' --max-time 15 "$base/__gymflow_spa_smoke__")"
[[ "$code" == "200" ]]
grep -q 'Infytter Fitness' /tmp/gymflow-spa-smoke.html
rm -f /tmp/gymflow-spa-smoke.html

printf 'OK: health, shell, pantalla-acceso y fallback SPA\n'
