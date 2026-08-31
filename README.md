# GymFlow / Infytter Fitness · V.1.02

Aplicación web/PWA para operación de gimnasio con Supabase, Vercel, Web Push y modo local de emergencia.

## V.1.02

Esta versión agrega dos bloques principales:

### Dashboard interactivo

- Los iconos de **Personas activas**, **Ingresos del día**, **Accesos hoy** y **Cuotas por vencer** abren el detalle correspondiente.
- La campana del encabezado despliega las últimas 10 notificaciones.
- Cada notificación usa un tono visual leve según su naturaleza: ingresos/altas, accesos, vencimientos o alertas.

### Usuarios y roles

- Registro PWA abierto.
- Toda cuenta nueva entra como `cliente`.
- Existe exactamente un `admin` master.
- Admin y coadmin administran roles por email desde **Personal**.
- `coadmin`: operación administrativa sin acciones de borrado y sin capacidad de modificar al master.
- `profe`: dashboard operativo, consulta de clientes y control de accesos; sin datos financieros.
- `cliente`: cuenta registrada con pantalla básica en V.1.02; su interfaz específica llegará más adelante.

## Estado cloud compartido

Desde V.1.02 los datos operativos ya no viven en un estado separado por cada usuario. La migración crea `gf_gym_state`, compartido por el staff autorizado.

Las escrituras pasan por la RPC `gf_apply_operations`, que integra operaciones bajo bloqueo transaccional. Esto mantiene el enfoque offline-first de V10 y evita reemplazos completos del estado cloud.

## Instalación / actualización

1. Aplicar en Supabase SQL Editor:
   `supabase/migrations/20260831_gf_roles_shared_state.sql`
2. Subir el proyecto a GitHub.
3. Esperar el deploy de Vercel.
4. Iniciar sesión con la cuenta administrativa existente y verificar que figure como **Admin master**.

La migración preserva `gf_user_state` como respaldo y, cuando existe, importa automáticamente el estado V10 de la cuenta master al nuevo estado compartido.

Ver también:

- `SUPABASE_SETUP.md`
- `NOTIFICATIONS_SETUP.md`
- `OFFLINE_MODE.md`
- `VERSION.md`
