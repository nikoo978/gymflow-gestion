# GymFlow / Infytter Fitness · V.1.04

Versión enfocada en **biblioteca de ejercicios** y separación visual estricta por rol.

## Interfaces

- **Admin/Coadmin:** panel administrativo completo.
- **Profe:** interfaz propia con Inicio, Alumnos, Ejercicios y Accesos; sin caja, reportes financieros, usuarios ni configuración global.
- **Cliente:** portal PWA mobile-first aislado del estado global y resuelto mediante su vínculo de cuenta.
- **Admin/Coadmin:** pueden abrir **Vista previa** para revisar cómo se ven los portales de Profesor y Cliente sin cambiar el rol real de la sesión.

## Biblioteca de ejercicios

- Grupos musculares y categorías.
- Imagen y video mediante URL.
- Series, repeticiones y descanso por defecto.
- Ejercicios base iniciales.
- Ejercicios personalizados compartidos con el equipo.
- RLS: Cliente sin acceso; Profe sólo administra sus personalizados; Admin/Coadmin gestionan la biblioteca.

## Migración desde V.1.03.1

Ejecutá una sola vez:

```text
supabase/migrations/20260831_gf_exercise_library_v104.sql
```

No requiere variables nuevas en Vercel.
