## 1. Tab por defecto

- [x] 1.1 Cambiar el valor inicial del signal `mode` en `home.ts` de `'create'` a `'join'`
- [x] 1.2 Verificar manualmente que al cargar `Home` la tab "Unirse a sala" aparece seleccionada y su formulario visible

## 2. Contraste del texto en la tab seleccionada

- [x] 2.1 Revisar `.home__tabs button` y `.home__tab--active` en `home.scss` para identificar por qué el texto de la tab activa no es legible
- [x] 2.2 Ajustar las reglas de estilo para asegurar contraste adecuado del texto en ambos estados (activo e inactivo)
- [x] 2.3 Verificar visualmente ambas tabs ("Crear sala" y "Unirse a sala") en estado activo e inactivo

## 3. Validación

- [x] 3.1 Probar el flujo completo de "Unirse a sala" y "Crear sala" en el navegador tras los cambios
- [x] 3.2 Confirmar que no se rompió ningún estilo existente en `home.scss`
