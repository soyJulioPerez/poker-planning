## Why

Al crear una sala o unirse a una existente, la conexión WebSocket y la respuesta del servidor pueden tardar entre 3 y 5 segundos. Durante ese lapso, `Home` no muestra ningún indicio de que algo está pasando — el botón queda igual que antes del click, y el usuario no tiene forma de saber si su acción se está procesando o si debería volver a intentarlo.

## What Changes

- Agregar un estado local `isSubmitting` en `Home`, activado al enviar `createRoom`/`joinRoom` y desactivado cuando: (a) la navegación a la sala ocurre (éxito), (b) llega un rechazo (`joinRejectedReason`), o (c) se cumple un timeout sin respuesta.
- Mientras `isSubmitting` es verdadero, el botón de submit correspondiente ("Crear sala" / "Unirse") se deshabilita y muestra un indicador visual de carga (spinner + texto tipo "Creando..." / "Uniéndose...").
- Agregar un timeout (ej. 10 segundos): si no se recibió respuesta en ese lapso, se apaga el estado de carga, se muestra un mensaje de error genérico, y el formulario vuelve a estar disponible para reintentar.
- Alcance acotado a `Home` (crear sala / unirse a sala); no incluye feedback de carga para acciones dentro de la sala ya creada (votar, revelar, etc.), que quedan fuera de este cambio.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `room-management`: se agrega, a los requisitos de creación de sala y unión a sala, la exigencia de mostrar un indicador visual de carga mientras se espera la respuesta del servidor, y de manejar el caso de falta de respuesta mediante un timeout.

## Impact

- Código afectado: [apps/web/src/app/pages/home/home.ts](apps/web/src/app/pages/home/home.ts), [apps/web/src/app/pages/home/home.html](apps/web/src/app/pages/home/home.html), [apps/web/src/app/pages/home/home.scss](apps/web/src/app/pages/home/home.scss).
- No afecta backend ni `shared-contracts`; es un cambio puramente de estado/UI en el cliente.
- No afecta `RoomPage` ni el mensaje "Conectando a la sala..." existente, que queda sin cambios.
