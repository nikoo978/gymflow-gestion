# GymFlow / Infytter Fitness · V.1.03.1

Corrección de flujo de usuarios antes de avanzar con V.1.04.

## Usuarios

- Admin/Coadmin ven **todos los emails registrados** en la PWA.
- Cada cuenta nueva aparece en Usuarios aunque todavía no tenga ficha vinculada.
- El rol se cambia desde la misma tabla.
- El vínculo ahora parte de la **cuenta PWA** y apunta a una ficha existente de Cliente o Profesor.
- Una ficha no puede quedar vinculada a dos cuentas distintas.
- Cambiar a `Coadmin` elimina el vínculo personal; cambiar entre `Cliente` y `Profe` invalida vínculos incompatibles.
- El Admin master sigue siendo único y protegido.

## Avisos de registro

- Cada alta de cuenta crea un evento persistente en Supabase.
- El Admin master recibe Web Push `Nueva cuenta PWA` si tiene notificaciones activadas.
- La campana mezcla estos eventos con los eventos operativos y muestra los últimos 10.
- La lista de Usuarios se refresca automáticamente cada 15 segundos.

## Clientes / Profesores

- Se eliminó el campo manual `Email PWA` de Clientes y Personal.
- El portal Cliente se resuelve mediante `gf_account_links`.
- El flujo correcto es: **registro de email → Usuarios → elegir rol → vincular ficha**.

## Migración desde V.1.03

Ejecutá una sola vez:

```text
supabase/migrations/20260831_gf_account_links_notifications.sql
```

No requiere variables nuevas en Vercel.
