# V.1.06

Interfaces móviles completas para Profesor y Cliente + seguimiento corporal + permisos de acceso por profesor.

- Profesor elimina “Accesos” de su navegación y usa Inicio / Alumnos / Progreso / Ejercicios / Rutinas.
- El botón “Permitir acceso” aparece en Inicio sólo a profesores habilitados individualmente por el Admin Master.
- El permiso se valida también en Supabase; ocultar el botón no es la única protección.
- El acceso manual se registra en la sucursal seleccionada por el profesor y se refleja en todas las segundas pantallas.
- Profesor puede registrar y consultar su progreso corporal y el de sus alumnos.
- Cliente incorpora Inicio / Progreso / Ejercicios / Mis rutinas / Profe.
- Cliente puede registrar peso, altura, cintura, cuello, cadera opcional y notas.
- El sistema calcula IMC y, cuando hay medidas suficientes, porcentaje de grasa corporal estimado mediante fórmula Navy. Se presenta como estimación orientativa, no diagnóstico médico.
- Las mediciones se almacenan en una tabla privada, indexada y sin acceso directo desde el navegador.
- Profesor y Cliente tienen acceso al glosario completo de ejercicios para consultar técnica, músculo, equipamiento, referencias y material visual.
- Los portales usan navegación inferior, áreas seguras y objetivos táctiles adecuados para iOS y Android.

## V.1.051

Sincronización global de segunda pantalla de accesos.

- La segunda pantalla se sincroniza entre PC, celular, tablet o TV mediante Supabase Realtime.
- Todos los dispositivos muestran el mismo resultado cuando ingresa un Cliente o Profesor.
- El último evento puede recuperarse durante 30 segundos al abrir o reconectar una segunda pantalla.
- Se mantiene BroadcastChannel/localStorage como respaldo local en la PC.
- Accesos permite copiar un enlace seguro para abrir la misma segunda pantalla en otro dispositivo.

## V.1.05

Rutinas + glosario de ejercicios + registro reforzado.

- Admin Master puede eliminar definitivamente cuentas/mail PWA sin borrar la ficha del gimnasio.
- El registro solicita nombre completo, DNI, email y contraseña; el DNI queda asociado al perfil de cuenta.
- Ejercicios funciona como glosario filtrable por músculo; cada ejercicio despliega una explicación breve y material visual opcional.
- Profesor puede crear y editar rutinas, asignarlas a uno o varios clientes vinculados y revisar las rutinas enviadas por cliente.
- Una rutina enviada por Profesor permanece en el Cliente hasta que el propio Cliente la elimine; los cambios posteriores del Profesor se reflejan automáticamente.
- Cliente puede crear, editar y eliminar hasta 3 rutinas personales desde su interfaz móvil.
- Portal Cliente separa Inicio, Mis rutinas y Rutinas del profe.
