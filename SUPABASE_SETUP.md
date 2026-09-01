# GymFlow V.1.04 · Supabase

## Actualización desde V.1.03.1

Si V.1.03.1 ya está funcionando, ejecutá **una sola vez** en Supabase → SQL Editor:

```text
supabase/migrations/20260831_gf_exercise_library_v104.sql
```

No repitas las migraciones anteriores.

La migración crea `gf_exercises` con RLS y una biblioteca base. Admin/Coadmin/Profe pueden leerla; Cliente no recibe acceso. Los profesores sólo pueden modificar o eliminar ejercicios personalizados creados por su propia cuenta.

## Base V.1.03.1

La versión anterior ya incorporó:

- `gf_account_links`: Cuenta PWA → ficha del gimnasio.
- `gf_account_events`: eventos persistentes de nuevas cuentas.
- RPCs de Usuarios, vínculos y portal Cliente.
- Web Push de nuevas cuentas al Admin master.

## Instalación desde cero

Ejecutá en orden:

```text
supabase/migrations/20260830_gf_user_state_rls.sql
supabase/migrations/20260831_gf_roles_shared_state.sql
supabase/migrations/20260831_gf_client_portal.sql
supabase/migrations/20260831_gf_account_links_notifications.sql
supabase/migrations/20260831_gf_exercise_library_v104.sql
```

No requiere variables nuevas en Vercel.
