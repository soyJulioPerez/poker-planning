## Context

`Home` (`apps/web/src/app/pages/home/home.ts`) dispara `createRoom()`/`joinRoom()`, que llaman `socketService.connect()` + `socketService.send(...)` sin ningún estado local que refleje "esperando respuesta". El único cambio de estado observable ocurre en un `effect()` en el constructor, que navega a `/room/:id` cuando `room()` y `myName()` tienen valor simultáneamente. No existe hoy ningún mecanismo de timeout en `RoomSocketService` ni en `Home`.

## Goals / Non-Goals

**Goals:**
- Mostrar feedback visual inmediato (deshabilitar botón + spinner/texto) desde el click hasta que se resuelve la acción (éxito, rechazo, o timeout).
- Evitar que el usuario quede con un spinner indefinido si el servidor nunca responde.

**Non-Goals:**
- No se implementa reconexión automática ni manejo de pérdida de conexión durante la sesión activa (tema separado, ya identificado en el backlog).
- No se agrega feedback de carga a acciones dentro de `RoomPage` (votar, revelar, resolver, etc.).
- No se cambia el protocolo WebSocket ni se agregan nuevos tipos de mensaje.

## Decisions

- **Estado local `isSubmitting` en `Home`**: un signal `boolean`, sin necesidad de distinguir "creando" vs. "uniéndose" en el estado en sí (la UI ya sabe cuál acción disparó el submit por el modo activo `mode()`).
- **Apagado por éxito**: no requiere lógica adicional — el `effect()` existente navega a `/room/:id` cuando llega la respuesta, lo cual destruye el componente `Home` y descarta el estado junto con él.
- **Apagado por rechazo**: se agrega un `effect()` (o se extiende el existente) que observa `joinRejectedReason()`; al pasar a un valor no-null, se apaga `isSubmitting` para que el usuario vea el mensaje de error y pueda corregir el formulario. Este camino solo aplica al flujo de "unirse" (crear sala no tiene un equivalente de rechazo hoy).
- **Timeout de seguridad**: al iniciar el submit, se programa un `setTimeout` (ej. 10000 ms) que, si se cumple antes de que `isSubmitting` ya se haya apagado por otra vía, apaga el estado y activa un nuevo signal local `submitTimedOut` (o similar) para mostrar un mensaje de error genérico ("No se pudo conectar. Intentá de nuevo."). El timeout se cancela (`clearTimeout`) si el estado se apaga primero por éxito o rechazo, para evitar que dispare tarde por error.
- **Alcance del timeout**: es una medida simple del lado del cliente, no un mecanismo robusto de cancelación de la petición en curso (el WebSocket puede igual completarse después del timeout; en ese caso, si el usuario ya reintentó, se aceptan ambas respuestas ya que `Home` simplemente reacciona al último estado recibido).

## Risks / Trade-offs

- [Timeout fijo de 10s] → puede sentirse corto en redes lentas o largo en fallos rápidos. Mitigación: es un valor de partida ajustable; no requiere ser configurable por ahora.
- [Doble intento tras timeout] → si el usuario reintenta después de un timeout y la primera petición igual llega tarde, podría navegar dos veces o generar un estado inconsistente. Mitigación: bajo riesgo dado que `send()` ya reencola por socket, y el `effect()` de navegación es idempotente (navegar dos veces a la misma ruta no tiene efecto visible).
