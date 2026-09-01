# GymFlow V.1.05 · Supabase

## Actualización desde V.1.04

V.1.05 agrega dos migraciones:

```text
supabase/migrations/20260901_gf_routines_registration_v105.sql
supabase/migrations/20260901_gf_routines_v105_indexes.sql
```

En producción ya fueron aplicadas el 1 de septiembre de 2026.

La primera migración agrega DNI a las cuentas PWA, refuerza el alta con nombre completo + DNI, habilita el borrado real de cuentas Auth exclusivamente para el Admin Master y crea el sistema privado de rutinas y asignaciones. La segunda agrega índices de soporte recomendados por el Performance Advisor.

Las tablas de rutinas viven en el esquema `private`; `anon` y `authenticated` no reciben acceso directo. La app usa RPCs `SECURITY DEFINER` con comprobación explícita de rol, identidad y propiedad. Los RPCs nuevos no son ejecutables por `anon`.

## Ejercicios

`gf_exercises` continúa con RLS. En V.1.05 Cliente también puede leer el glosario para construir sus rutinas personales; la creación/edición sigue restringida al staff según rol y autoría.

## Base V.1.03.1 / V.1.04

Se mantienen:

- `gf_account_links`: Cuenta PWA → ficha del gimnasio.
- `gf_account_events`: eventos persistentes de nuevas cuentas.
- RPCs de Usuarios, vínculos y portal Cliente.
- Web Push de nuevas cuentas al Admin Master.
- `gf_exercises`: glosario/biblioteca compartida.

## Instalación desde cero

Ejecutá en orden:

```text
supabase/migrations/20260830_gf_user_state_rls.sql
supabase/migrations/20260831_gf_roles_shared_state.sql
supabase/migrations/20260831_gf_client_portal.sql
supabase/migrations/20260831_gf_account_links_notifications.sql
supabase/migrations/20260831_gf_exercise_library_v104.sql
supabase/migrations/20260901_gf_routines_registration_v105.sql
supabase/migrations/20260901_gf_routines_v105_indexes.sql
```

No requiere variables nuevas en Vercel.
