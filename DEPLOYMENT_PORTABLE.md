# Hosting portable (migración V1.07)

Este documento describe la ruta Docker-first para ejecutar GymFlow fuera de Vercel. Durante la migración, Vercel se conserva únicamente como rollback hasta validar el nuevo host y completar el cutover.

## Ejecución con Docker Compose

1. Copiar `.env.example` a `.env`.
2. Cargar los secretos reales únicamente en el VPS/Coolify/secret store. No committear `.env`.
3. Definir `PUBLIC_APP_URL` con el origen HTTPS público que recibirá los callbacks de QStash.
4. Construir y levantar:

```bash
docker compose up -d --build
```

5. Verificar:

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -fsSI http://127.0.0.1:3000/
curl -fsSI http://127.0.0.1:3000/pantalla-acceso
```

El contenedor escucha en `0.0.0.0:3000`, sirve `/api/*`, la build Vite `dist/`, assets estáticos y fallback SPA a `index.html`.

## Reverse proxy / HTTPS

El proxy debe terminar HTTPS y reenviar tráfico HTTP al puerto interno 3000. GymFlow no depende del proveedor del proxy. El dominio definitivo se configura mediante `PUBLIC_APP_URL` y posteriormente en Supabase Auth/QStash durante el cutover.

## Coolify

Configuración prevista:

- Fuente: repositorio GitHub.
- Build: `Dockerfile` del repositorio.
- Puerto interno: `3000`.
- Health check: `/api/health`.
- Variables: cargar las de `.env.example` desde Secrets/Environment Variables.
- No usar Vercel Build ni Vercel Functions.

No se requiere conocer el dominio final para validar inicialmente el contenedor. Para Web Push/PWA en dispositivos reales sí se necesita un origen HTTPS estable.

## Orden de cutover

1. Validar nuevo deployment y HTTPS.
2. Verificar UI, Auth, API, `/pantalla-acceso`, Realtime y offline.
3. Actualizar Supabase Auth URLs si cambia el dominio.
4. Cambiar `PUBLIC_APP_URL` y callbacks programados de QStash al nuevo origen.
5. Reactivar/verificar Push en el nuevo origen; las PushSubscription del dominio Vercel no son reutilizables entre orígenes.
6. Validar PWA e instalación desde el nuevo dominio.
7. Mover DNS.
8. Sólo entonces retirar integración/configuración de Vercel y eliminar el proyecto si ya no es necesario.

V1.07 no se considera publicada hasta que el tráfico de producción funcione desde el nuevo host sin Vercel en el request path.
