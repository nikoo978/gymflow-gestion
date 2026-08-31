# Proyecto Supabase

Usar `nikoo978's Project` (`ubfqwmhxkjtqdcfnsmwe`).

# GymFlow · Supabase Auth + RLS

## Arquitectura aplicada

- Auth: `@supabase/supabase-js` con email/contraseña.
- Sesión: gestionada exclusivamente por Supabase (`getSession` + `onAuthStateChange`).
- Recuperación: `resetPasswordForEmail` y pantalla para establecer la nueva contraseña.
- Datos locales: IndexedDB, store `local_state`.
- Caché cloud: IndexedDB separado, store `cloud_state`, clave = `user.id`.
- Datos cloud reales: tabla `public.gf_user_state`, protegida por RLS.
- El modo local nunca se sube automáticamente al iniciar sesión.
- Al cerrar/cambiar de cuenta se elimina la caché cloud de la cuenta anterior; los datos locales permanecen.
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
