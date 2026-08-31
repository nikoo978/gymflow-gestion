# GymFlow V.1.02 · Supabase

Proyecto actual: `nikoo978's Project` (`ubfqwmhxkjtqdcfnsmwe`).

## Antes de desplegar V.1.02

Ejecutar **una sola vez** en Supabase SQL Editor:

`supabase/migrations/20260831_gf_roles_shared_state.sql`

Recomendación: aplicar primero la migración y después hacer el deploy/commit de V.1.02.

## Qué hace la migración

- Crea `gf_profiles` con roles `admin / coadmin / profe / cliente`.
- Conserva exactamente un `Admin master`.
- Si ya existen usuarios, el usuario más antiguo de Supabase queda como master.
- Todas las cuentas nuevas se crean como `cliente`.
- El Admin master nunca puede ser degradado ni reemplazado por otro usuario.
- Admin y coadmin pueden cambiar roles por email desde **Personal → Cuentas PWA y roles**.
- Crea `gf_gym_state`, estado único compartido del gimnasio.
- Migra automáticamente el estado V10 del usuario master desde `gf_user_state` cuando existe.
- `profe` nunca recibe datos de caja/cierres desde Supabase.
- Todas las escrituras compartidas pasan por `gf_apply_operations`, con bloqueo transaccional e integración por operación.
- `coadmin` no puede ejecutar operaciones de borrado.
- `profe` sólo puede escribir eventos del control de accesos y su actividad asociada.

La tabla V10 `gf_user_state` se conserva como respaldo y no se elimina.

## Variables Vercel

Se mantienen las variables existentes:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Y las variables del sistema de notificaciones descriptas en `NOTIFICATIONS_SETUP.md`.

No usar `service_role` en el navegador.

## Roles

### Admin master

- Único.
- Acceso total.
- Único rol que puede eliminar registros.
- Único rol que puede usar Modo local de emergencia.
- No puede ser degradado ni modificado por otro rol.

### Coadmin

- Operación administrativa completa.
- Puede asignar `coadmin`, `profe` o `cliente` a cuentas registradas.
- No puede eliminar registros.
- No puede modificar al Admin master.
- No puede usar Modo local.

### Profe

- Dashboard operativo sin información financiera.
- Consulta de clientes.
- Control de accesos.
- Sin caja, reportes financieros, administración de roles ni configuración de notificaciones.

### Cliente

- Puede registrarse/iniciar sesión en la PWA.
- En V.1.02 recibe una pantalla de cuenta básica; la interfaz específica del alumno se implementará en una versión posterior.
