# GymFlow · Estado de migraciones

## V.1.04 — Biblioteca de ejercicios

Nueva migración:

```text
supabase/migrations/20260831_gf_exercise_library_v104.sql
```

Si V.1.03.1 ya está aplicada, ejecutá únicamente esta migración nueva. No repitas las anteriores.

### Resultado

- Crea `gf_exercises` con RLS.
- Admin/Coadmin/Profe pueden leer la biblioteca.
- Profe sólo puede modificar/eliminar sus ejercicios personalizados.
- Admin/Coadmin pueden editar ejercicios base y personalizados; los ejercicios base no se eliminan desde la UI.
- Cliente no tiene acceso a la tabla de ejercicios en V.1.04.
- Incluye ejercicios base iniciales.
