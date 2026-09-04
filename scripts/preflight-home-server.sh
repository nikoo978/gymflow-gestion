#!/usr/bin/env bash
set -euo pipefail

fail=0
ok() { printf 'OK   %s\n' "$1"; }
warn() { printf 'WARN %s\n' "$1"; }
err() { printf 'FAIL %s\n' "$1"; fail=1; }

printf 'GymFlow / Coolify home-server preflight\n\n'

if [[ "$(uname -s)" == "Linux" ]]; then ok "Linux"; else err "Se requiere Linux"; fi
arch="$(uname -m)"
case "$arch" in x86_64|aarch64|arm64) ok "Arquitectura 64-bit: $arch" ;; *) err "Arquitectura no soportada/recomendada: $arch" ;; esac

if command -v docker >/dev/null 2>&1; then
  ok "Docker: $(docker --version)"
else
  warn "Docker no encontrado. El instalador oficial de Coolify puede instalar/configurarlo; Docker vía snap no es compatible."
fi

if command -v curl >/dev/null 2>&1; then ok "curl disponible"; else err "Falta curl"; fi
if command -v ssh >/dev/null 2>&1; then ok "SSH client disponible"; else err "Falta SSH client"; fi

mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
if (( mem_kb >= 2000000 )); then ok "RAM >= 2 GB"; else warn "Coolify recomienda al menos 2 GB RAM; para builds de GymFlow conviene más margen."; fi

free_kb="$(df -Pk / | awk 'NR==2 {print $4}')"
if (( free_kb >= 30*1024*1024 )); then ok "Espacio libre >= 30 GB"; else warn "Coolify recomienda al menos 30 GB libres."; fi

if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet ssh; then ok "SSH activo"; else warn "Verificar que SSH esté habilitado y accesible en LAN."; fi

printf '\nRed/Internet:\n'
printf -- '- Para exposición directa: router con port-forward TCP 80/443 hacia este servidor + IP LAN reservada.\n'
printf -- '- Si hay CGNAT/no se pueden abrir puertos: usar Cloudflare Tunnel con dominio propio.\n'
printf -- '- No exponer el puerto 3000 de GymFlow a Internet; Coolify/Traefik debe ser el único reverse proxy público.\n'
printf -- '- Mantener el panel Coolify restringido; tras asignarle dominio seguro pueden cerrarse 8000/6001/6002 al exterior.\n'

exit "$fail"
