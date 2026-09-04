# GymFlow V1.07 — Ubuntu Home Server + Docker + Coolify

Objetivo final: GitHub → Dockerfile → Coolify self-hosted → GymFlow. Vercel se conserva sólo como rollback hasta terminar el cutover.

## 1. Host recomendado

- Ubuntu Server LTS 24.04 (22.04 también válido).
- CPU x86_64/AMD64 o ARM64; mínimo Coolify: 2 cores, 2 GB RAM y 30 GB libres. Para construir GymFlow en el mismo host conviene 4+ cores, 8 GB RAM y SSD con margen.
- Ethernet, IP LAN fija/reserva DHCP, hora/NTP correctos y reinicio automático tras corte eléctrico en BIOS/UEFI.
- UPS recomendado para producción casera.
- SSH habilitado. No instalar Docker mediante Snap.

Antes de instalar:

```bash
bash scripts/preflight-home-server.sh
```

## 2. Red: elegir una de dos rutas

### A — IP pública + port forwarding

Reservar una IP LAN para el servidor. En el router reenviar sólo TCP 80 y 443 al host Coolify. SSH debe quedar limitado a LAN/VPN siempre que sea posible. No publicar el puerto 3000 de GymFlow.

Si la IP pública cambia, usar DNS dinámico o automatización equivalente.

### B — CGNAT / sin port forwarding: Cloudflare Tunnel

Es la ruta preferida si el ISP usa CGNAT, no permite abrir 80/443 o se quiere ocultar la IP residencial. Requiere dominio propio gestionado en Cloudflare. Coolify documenta Tunnel tanto para recursos individuales como para todos los recursos.

No decidir esto por intuición: comprobar primero si la WAN del router coincide con la IP pública observada. Si no coincide o está en rango privado/CGNAT, asumir que el port-forward directo no será suficiente.

## 3. Instalar Coolify

Coolify recomienda una máquina limpia. En Ubuntu LTS:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

El instalador configura Docker y `/data/coolify`. El panel inicial usa el puerto 8000. Puertos relevantes de Coolify self-hosted: SSH, 80/443 y, durante configuración directa del panel, 8000/6001/6002. Una vez que el panel tenga dominio/HTTPS, restringir los puertos administrativos al exterior.

Crear inmediatamente la cuenta administrativa y asegurar el acceso al panel.

## 4. Crear GymFlow en Coolify

Crear Project → Production → New Resource → Git Repository.

Configuración exacta:

- Repository: `nikoo978/gymflow-gestion`
- Branch de staging inicial: `v1.07-portable-docker-hosting`
- Build Pack: **Dockerfile** (no Nixpacks)
- Base Directory: `/`
- Dockerfile: `/Dockerfile`
- Port Exposes / interno: `3000`
- Health: Dockerfile `HEALTHCHECK` sobre `/api/health`
- Restart: administrado por Coolify/Docker
- No persistent storage para GymFlow: el proceso Node es stateless; estado persistente sigue en Supabase/Upstash.
- No Port Mapping público `3000:3000` en producción Coolify; el proxy debe llegar al puerto interno 3000.

El `Dockerfile` ejecuta el runtime como usuario no-root `node`.

## 5. Variables en Coolify

Cargar desde la pestaña Environment Variables. Nunca guardar secretos en Git, Dockerfile, imagen o logs.

Runtime obligatorias/esperadas:

```dotenv
PORT=3000
HOST=0.0.0.0
MAX_BODY_BYTES=1048576
PUBLIC_APP_URL=https://DOMINIO_FINAL
SUPABASE_URL=https://ubfqwmhxkjtqdcfnsmwe.supabase.co
SUPABASE_ANON_KEY=<anon-key-publica>
UPSTASH_REDIS_REST_URL=<url>
UPSTASH_REDIS_REST_TOKEN=<secret>
REDIS_STATE_KEY=gymflow
QSTASH_TOKEN=<secret>
NOTIFICATION_SECRET=<secret>
VAPID_PUBLIC_KEY=<publica>
VAPID_PRIVATE_KEY=<secret>
VAPID_SUBJECT=mailto:<contacto>
```

`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` son configuración pública de frontend; el código está fijado al Project Ref `ubfqwmhxkjtqdcfnsmwe` y conserva fallback público para evitar apuntar a otro proyecto. Si se configuran como build variables, deben corresponder exactamente a ese proyecto. Nunca usar `service_role` en una variable `VITE_*`.

En Coolify marcar como runtime-only todos los secretos del servidor. No convertir tokens privados en Build Variables. `PUBLIC_APP_URL` debe ser el origen HTTPS real y sin path.

## 6. Primer deployment sin cutover

Desplegar primero la rama V1.07. No tocar DNS de producción ni Vercel.

Validar desde fuera de la LAN mediante el hostname temporal/dominio de staging:

```bash
bash scripts/smoke-production.sh https://HOST-STAGING
```

Además probar manualmente: login/logout, roles, Admin Preview, ejercicios, rutinas, Realtime, `/pantalla-acceso`, creación/uso de capability links, offline/recuperación, PWA y notificaciones.

## 7. HTTPS y reverse proxy

Coolify gestiona el proxy. GymFlow escucha HTTP en `0.0.0.0:3000`; TLS termina delante del contenedor. No instalar Nginx dentro de la imagen.

El origen público definitivo debe ser HTTPS. Es obligatorio para la experiencia PWA/Push real y evita mezclar orígenes durante la migración.

## 8. Integraciones antes del corte

### Supabase Auth

Cuando exista dominio final, revisar en el proyecto `ubfqwmhxkjtqdcfnsmwe`:

- Site URL → nuevo origen.
- Redirect URLs → nuevo origen y callbacks realmente utilizados.
- OAuth provider callbacks, si existen.
- Mantener temporalmente el origen Vercel permitido durante rollback; retirarlo sólo al final.

### QStash

`PUBLIC_APP_URL` determina nuevos callbacks `/api/notify`. Revisar también jobs existentes creados antes de la migración: cualquier callback almacenado que apunte a `gymflow-gestion.vercel.app` debe recrearse/actualizarse hacia el dominio nuevo antes de apagar Vercel.

### Web Push

Conservar las mismas claves VAPID. Las `PushSubscription` pertenecen al origen: las suscripciones creadas en `gymflow-gestion.vercel.app` no migran al dominio nuevo. Los usuarios deberán habilitar/registrar notificaciones en el nuevo origen. Validar envío inmediato y programado.

### PWA

El dominio nuevo es otro origen: reinstalar PWA desde el dominio definitivo. Verificar manifest, service worker, scope, start URL, cache y offline en Android/iOS/desktop.

### Segunda pantalla

Validar `/pantalla-acceso`, Supabase Realtime y fallbacks BroadcastChannel/localStorage. Los enlaces generados con `location.origin` deben quedar naturalmente en el nuevo dominio.

## 9. Home-server hardening mínimo

- Actualizaciones de seguridad de Ubuntu activas.
- Firewall: no exponer bases de datos ni el puerto 3000; sólo proxy/HTTPS y administración estrictamente necesaria.
- SSH con claves; deshabilitar password login después de comprobar acceso por clave.
- Backups de `/data/coolify` y configuración del host en almacenamiento distinto al mismo disco.
- Monitorizar disco, RAM, temperatura, salud SMART, contenedores y disponibilidad externa.
- UPS + auto power-on recomendado.
- Mantener al menos una copia de las variables/secrets en un gestor seguro externo al servidor.
- No self-hostear Supabase/Redis durante V1.07.

## 10. Deploy automático

Coolify puede desplegar desde GitHub. Primero validar deployments manuales desde la rama. Tras merge a `main`, configurar auto-deploy de `main` en Coolify/GitHub App o webhook de Coolify. GitHub Actions seguirá validando install + audit + build + tests + Docker build; no necesita secretos de producción para CI.

No crear SSH/CD ad-hoc desde Actions mientras Coolify pueda ser el controlador de despliegue.

## 11. Cutover

1. Nuevo deployment saludable y HTTPS desde Internet.
2. Smoke + pruebas funcionales completas.
3. Configurar dominio final en Coolify.
4. Actualizar Supabase Auth URLs manteniendo rollback temporal.
5. Actualizar/recrear QStash callbacks y `PUBLIC_APP_URL`.
6. Validar Push y PWA en el nuevo origen.
7. Cambiar DNS/túnel hacia el Home Server.
8. Verificar usuarios reales, API, Realtime, offline y segunda pantalla.
9. Observar estabilidad antes de retirar rollback.
10. Recién entonces eliminar `vercel.json`, `vite.vercel.config.js`, `build:vercel`, referencias Vercel e integración GitHub↔Vercel; actualizar APP_VERSION/package/VERSION/README a V1.07/1.07.0 y eliminar el proyecto Vercel.

V1.07 sólo queda publicada cuando producción funciona desde el Home Server sin Vercel en el request path.

## 12. Rollback

Mientras Vercel exista: si el Home Server falla antes del cierre de migración, revertir DNS/túnel al origen Vercel y restaurar las URLs de integración necesarias. No borrar Vercel hasta haber validado el nuevo origen durante una ventana suficiente.
