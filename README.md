# GymFlow / Infytter Fitness · V.1.067

PWA de gestión para Infytter Fitness con interfaces separadas para Admin/Coadmin, Profesor y Cliente, sincronización Cloud mediante Supabase y despliegue en Vercel.

## Interfaces

- **Admin/Coadmin:** administración de clientes, personal, usuarios, ejercicios, caja, reportes, accesos y notificaciones según permisos.
- **Admin Master:** máxima autoridad; además gestiona permisos individuales de Profesor y eliminación definitiva de cuentas PWA.
- **Profesor:** interfaz móvil con Inicio, Alumnos, Progreso, Ejercicios y Rutinas. El botón **Permitir acceso** sólo aparece cuando el Admin Master lo habilita.
- **Cliente:** portal mobile-first con membresía, progreso corporal, biblioteca completa de ejercicios y rutinas.
- **Vista previa Admin:** permite entrar visualmente al interfaz completo de Profesor o Cliente y volver a Administración mediante una X, sin cambiar el rol real.

## Biblioteca de ejercicios

- **1.281 ejercicios únicos visibles** construidos a partir de **1.336 IDs/GIFs** de la biblioteca original.
- Los 47 ejercicios que poseen variantes visuales aparecen una sola vez.
- Al desplegar uno de esos ejercicios se muestran juntos sus 2, 3 o 4 GIFs, sin submenús, descripciones duplicadas ni etiquetas de variante.
- Nombre visible: nombre más común en Argentina.
- Buscador por nombre argentino, alias, nombre original, músculo, equipamiento, descripción e IDs asociados.
- GIFs alojados en Cloudinary mediante `https://res.cloudinary.com/po0pnxfc/image/upload/ID.gif`.

## Rutinas

- Profesor crea y edita rutinas compartidas y puede enviarlas a clientes vinculados.
- Cliente puede gestionar hasta 3 rutinas personales y quitar de su cuenta una rutina enviada por Profesor.
- El constructor muestra cada ejercicio una sola vez y mantiene compatibilidad con rutinas antiguas que hayan guardado el ID de una variante.

## Progreso corporal

Cliente y Profesor disponen de seguimiento de peso, altura y medidas, con IMC y porcentaje de grasa estimado cuando existen los datos necesarios. Los cálculos se presentan como referencia orientativa.

## Accesos y segunda pantalla

La segunda pantalla de accesos se sincroniza entre dispositivos mediante Supabase Realtime. PC, celular, tablet o TV muestran el mismo evento de acceso mientras estén vinculados a la misma pantalla.

## Plataforma

- React 19 + Vite
- Supabase Auth / PostgreSQL / Realtime
- Vercel
- PWA y operación local de emergencia para Admin Master

El historial detallado de cambios está en `VERSION.md`.
