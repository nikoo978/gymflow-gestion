# Proyecto Supabase

Usar `nikoo978's Project` (`ubfqwmhxkjtqdcfnsmwe`).

# GymFlow · Supabase Auth + RLS

## Arquitectura aplicada

- Auth: `@supabase/supabase-js` con email/contraseña.
- Sesión: gestionada exclusivamente por Supabase (`getSession` + `onAuthStateChange`).
- Recuperación: `resetPasswordForEmail` y pantalla para establecer la nueva contraseña.
- Caché cloud: IndexedDB, store `cloud_state`, clave = `user.id`.
- Cola offline: IndexedDB, store `pending_ops`, más WAL de emergencia para proteger el intervalo previo al commit de IndexedDB.
- Datos cloud reales: tabla `public.gf_user_state`, protegida por RLS.
- El modo local sólo existe en PC, requiere PIN maestro y se usa sobre la última copia cloud de la cuenta.
- Al volver Internet, las operaciones pendientes se concilian con el estado cloud actual mediante `updated_at`; no se reemplaza Cloud con una copia antigua completa.
- La caché cloud por usuario se conserva para que esa PC mantenga una copia de contingencia.
- Push remoto: cada suscripción Redis queda ligada a `userId`; no se envían eventos de una cuenta a otra.
- Service Worker: no tiene `fetch` handler, por lo que no cachea Supabase ni APIs externas.

## Variables Vercel

Configurar en Preview y Production:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Los valores `VITE_*` / anon-publishable son públicos. No usar `service_role` en el navegador.

## Base de datos

Aplicar:

`supabase/migrations/20260830_gf_user_state_rls.sql`

## Auth

En Supabase debe estar habilitado Email. La confirmación de email puede quedar activada o desactivada:

- Si está activada, GymFlow informa que hay que confirmar el correo y no presupone una sesión.
- Si está desactivada, la sesión se abre al crear la cuenta.

Configurar Site URL y Redirect URLs para producción y previews usados en pruebas.
