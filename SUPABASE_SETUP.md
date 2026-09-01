# GymFlow V.1.03.1 · Supabase

## Actualización desde V.1.03

Si V.1.03 ya está funcionando, ejecutá **una sola vez** en Supabase → SQL Editor:

```text
supabase/migrations/20260831_gf_account_links_notifications.sql
```

No repitas las migraciones anteriores.

Esta migración agrega:

- `gf_account_links`: relación segura Cuenta PWA → ficha del gimnasio.
- `gf_account_events`: historial persistente de cuentas registradas.
- `gf_list_accounts()`: permite a Admin/Coadmin ver todos los emails registrados.
- `gf_set_account_link()` / `gf_unlink_account()`: el vínculo se administra desde Usuarios.
- `gf_list_account_events()`: alimenta la campana administrativa.
- `gf_registration_push_target()`: permite verificar un registro para enviar Web Push al Admin master.
- `gf_get_my_client_portal()` actualizado para resolver la ficha por vínculo explícito y no por email escrito manualmente.

## Nuevo flujo de vinculación

1. La persona crea una cuenta PWA con su email.
2. La cuenta aparece automáticamente en **Usuarios**.
3. Admin/Coadmin define el rol.
4. Desde esa misma fila de email selecciona la ficha Cliente o Profesor correspondiente.
5. La PWA de esa cuenta pasa a usar esa ficha.

Ya no se carga `Email PWA` desde Clientes ni Personal.

## Web Push de cuentas nuevas

Cuando una cuenta se registra, la app llama `/api/account-events`. El servidor verifica que ese `user_id + email` exista realmente en Supabase y envía una notificación Web Push al **Admin master**.

Para recibirla, el Admin master debe tener Web Push activo en al menos un dispositivo. Se reutilizan las mismas variables VAPID/Redis existentes; **no hay variables nuevas**.

## Instalación desde cero

Ejecutá en orden:

```text
supabase/migrations/20260830_gf_user_state_rls.sql
supabase/migrations/20260831_gf_roles_shared_state.sql
supabase/migrations/20260831_gf_client_portal.sql
supabase/migrations/20260831_gf_account_links_notifications.sql
```
