# Web Push en Infytter

Arquitectura: PWA + Service Worker + Web Push/VAPID + Upstash Redis + QStash.

## Variables de Vercel

Configurar en **Production** (y Preview si se desea probar allí):

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
REDIS_STATE_KEY=gymflow
QSTASH_TOKEN=...
NOTIFICATION_SECRET=...
PUBLIC_APP_URL=https://gymflow-gestion.vercel.app
```

No hace falta `VITE_VAPID_PUBLIC_KEY`: el frontend obtiene únicamente la clave pública desde `/api/push?action=diagnostics`.

## Comprobación después del deploy

1. Abrir `https://gymflow-gestion.vercel.app/api/push?action=diagnostics`.
2. Debe devolver JSON, nunca `index.html`.
3. `configuredForImmediatePush` debe ser `true`.
4. `configuredForScheduledPush` debe ser `true` para los avisos de vencimiento.
5. En `/notificaciones`, activar el dispositivo y ejecutar **Probar envío remoto**.

## iPhone/iPad

Instalar la PWA desde Safari (Compartir → Agregar a inicio), abrirla desde su ícono y recién entonces habilitar notificaciones.

## Seguridad

- Diagnóstico: público, expone sólo la clave VAPID pública y booleanos de configuración.
- Suscripciones/preferencias/pruebas: requieren sesión Supabase.
- `/api/notify`: requiere `Authorization: Bearer NOTIFICATION_SECRET` y es llamado por QStash.
- Las suscripciones inválidas y las respuestas Push 404/410 se eliminan de Redis.
