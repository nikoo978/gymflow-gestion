# GymFlow V.1.03 · Supabase

## Actualización desde V.1.02

V.1.02 ya creó `gf_profiles`, roles y el estado compartido `gf_gym_state`.
Para V.1.03 ejecutá una sola vez en **Supabase → SQL Editor**:

```text
supabase/migrations/20260831_gf_client_portal.sql
```

La migración agrega `gf_get_my_client_portal()`, una función `SECURITY DEFINER` que:

- identifica la cuenta autenticada con `auth.uid()`;
- exige rol `cliente`;
- vincula la cuenta por email con una ficha `Cliente` del gimnasio;
- devuelve exclusivamente datos sanitizados de esa ficha y sus propios accesos;
- nunca devuelve caja, cierres, notificaciones globales, otros clientes ni configuración.

## Vinculación de cuentas

En **Clientes → Editar → Email PWA**, cargá exactamente el email con el que esa persona se registró.
Para profesores hacé lo mismo en **Personal → Editar → Email PWA** y luego asigná el rol `Profe` en **Usuarios**.

## Roles

- `admin`: único master.
- `coadmin`: gestión y roles, sin borrado destructivo.
- `profe`: interfaz operativa sin finanzas.
- `cliente`: portal personal.

No requiere variables de entorno nuevas.
