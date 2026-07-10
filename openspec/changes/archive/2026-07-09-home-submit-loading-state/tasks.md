## 1. Estado de carga en Home

- [x] 1.1 Agregar signal `isSubmitting` a `Home` (`home.ts`)
- [x] 1.2 Activar `isSubmitting` al inicio de `createRoom()` y `joinRoom()`
- [x] 1.3 Agregar un timeout (ej. 10000 ms) al iniciar el submit; si se cumple sin que el estado ya se haya apagado, desactivar `isSubmitting` y activar un signal de error genérico (ej. `submitTimedOut`)
- [x] 1.4 Cancelar el timeout cuando el estado se apaga por otra vía (éxito o rechazo), para evitar que dispare tarde

## 2. Apagado del estado de carga

- [x] 2.1 Confirmar que el `effect()` existente (navegación a `/room/:id`) apaga implícitamente el estado al destruir `Home`
- [x] 2.2 Agregar u observar `joinRejectedReason()` para apagar `isSubmitting` cuando cambie a un valor no-null

## 3. UI: spinner y deshabilitado

- [x] 3.1 En `home.html`, deshabilitar el botón de submit correspondiente mientras `isSubmitting` es verdadero
- [x] 3.2 Mostrar un indicador visual de carga (spinner + texto "Creando..." / "Uniéndose...") en el botón o cerca de él mientras se envía
- [x] 3.3 Mostrar el mensaje de error genérico cuando se cumple el timeout (`submitTimedOut`)
- [x] 3.4 Aplicar estilos en `home.scss` para el spinner y el estado deshabilitado del botón

## 4. Validación

- [x] 4.1 Probar que el botón se deshabilita y muestra el indicador al crear una sala
- [x] 4.2 Probar que el botón se deshabilita y muestra el indicador al unirse a una sala
- [x] 4.3 Probar que el indicador se apaga correctamente ante un rechazo (nombre en uso / sala no encontrada) y el formulario queda disponible para reintentar
- [x] 4.4 Simular ausencia de respuesta (ej. desconectando la red) y confirmar que, tras el timeout, se muestra el error y se puede reintentar
- [x] 4.5 Confirmar que el flujo de éxito (navegación a la sala) sigue funcionando sin cambios
