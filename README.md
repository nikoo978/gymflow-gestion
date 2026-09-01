# GymFlow / Infytter Fitness · V.1.05

Versión enfocada en **rutinas**, glosario de ejercicios y gestión completa de cuentas PWA.

## Interfaces

- **Admin/Coadmin:** panel administrativo. El Admin Master puede eliminar definitivamente cuentas/mail PWA; la ficha del gimnasio se conserva.
- **Profe:** interfaz propia con Inicio, Alumnos, Ejercicios, Rutinas y Accesos; sin caja, finanzas ni gestión global de usuarios.
- **Cliente:** portal PWA mobile-first con Inicio, Mis rutinas y Rutinas del profe.
- **Admin/Coadmin:** mantienen Vista previa de Profesor y Cliente sin alterar permisos reales.

## Registro

Las nuevas cuentas solicitan nombre completo, DNI, email y contraseña. Empiezan como Cliente y luego pueden vincularse desde Usuarios a una ficha existente.

## Glosario de ejercicios

- Filtro por músculo y búsqueda por nombre.
- Cada ejercicio se despliega para mostrar una explicación breve.
- Soporta URL de imagen/GIF y video; el contenido multimedia definitivo se completará más adelante.
- Los valores de series, repeticiones y descanso sirven como sugerencia al agregar el ejercicio a una rutina.

## Rutinas

- Profesor crea y edita rutinas compartidas y puede enviarlas a uno o varios clientes con cuenta vinculada.
- Editar una rutina enviada actualiza la versión que ven todos sus clientes.
- Profesor no puede retirar una rutina ya enviada; permanece hasta que el Cliente la elimine de su cuenta.
- Cliente puede crear hasta 3 rutinas personales y gestionarlas desde el celular.
- Rutinas y asignaciones viven en el esquema privado de Supabase y sólo se acceden mediante RPCs con control de rol/propiedad.

## Migraciones V.1.05

```text
supabase/migrations/20260901_gf_routines_registration_v105.sql
supabase/migrations/20260901_gf_routines_v105_indexes.sql
```

Ambas están aplicadas en producción. No requiere variables nuevas en Vercel.
