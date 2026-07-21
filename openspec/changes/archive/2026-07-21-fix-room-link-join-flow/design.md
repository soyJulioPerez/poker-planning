## Context

Confirmado manualmente contra el sitio en producción (`https://soyjulioperez.github.io/poker-planning/`):

- `shareLink` en `RoomPage` (`apps/web/src/app/pages/room/room.ts:64-66`) construye la URL como `${window.location.origin}/room/${roomId}`. `window.location.origin` es solo el dominio (`https://soyjulioperez.github.io`), sin el sub-path `/poker-planning/` con el que la app está desplegada (`base-href=/poker-planning/`, ver `.github/workflows/deploy-web.yml`). El resultado es una URL que, al compartirse y abrirse, produce un 404 real de GitHub Pages sin fallback aplicable (la ruta `/room/<id>` no coincide con ningún asset del sitio, que vive bajo `/poker-planning/`).
- Cuando se abre la URL *correcta* de una sala (`/poker-planning/room/<id>`) sin haber pasado antes por Home, Angular Router sí monta `RoomPage` (el truco de `404.html` de GitHub Pages funciona para esto). Pero `RoomPage.constructor()` llama `rejoinIfNeeded(roomId)` (`room-socket.service.ts:92-104`), que hace un `return` inmediato si `sessionStorage` no tiene una sesión guardada (`if (!raw) return;`). Como quien nunca pasó por Home no tiene esa sesión, `room()` y `myName()` quedan `null` para siempre, y la plantilla muestra indefinidamente "Conectando a la sala..." (`room.html`, rama `@else`).

## Goals / Non-Goals

**Goals:**
- `shareLink` produce siempre una URL completa y funcional, sin importar el `base-href` de despliegue.
- Quien abre el link de una sala sin sesión previa es redirigido automáticamente a Home, con el código de sala ya precargado en el formulario de "Unirse a sala", pudiendo completar solo su nombre para unirse.
- El comportamiento de reconexión existente (con sesión previa, ej. recargar la página estando ya dentro de la sala) no cambia.

**Non-Goals:**
- No se cambia el mecanismo de `sessionStorage` en sí (`SESSION_KEY`, `saveSession`, `clearSession`) — se reutiliza tal cual está.
- No se agrega ningún mensaje intermedio tipo "te estamos redirigiendo" — la redirección es inmediata y silenciosa, ya que ocurre antes de que haya nada sustancial que mostrarle al usuario en `RoomPage`.
- No se toca el backend (`apps/realtime-api`) — ambos bugs son de enrutamiento/estado del lado del cliente.

## Decisions

### Decisión 1: `shareLink` usa `window.location.href` en vez de reconstruir la ruta a mano
Reemplazar la construcción manual (`${origin}/room/${roomId}`) por derivar la URL a partir de `window.location.href` en el momento en que `RoomPage` ya está montado en la ruta correcta (`/poker-planning/room/<roomId>`) — es decir, usar la URL real del navegador en vez de reconstruirla. Esto es correcto porque `shareLink` solo se usa/muestra cuando el usuario ya está parado en esa página, así que `window.location.href` ya contiene el `base-href` correcto sin necesidad de conocerlo de antemano.

**Alternativa descartada**: importar/hardcodear el `base-href` (`/poker-planning/`) como constante en el código para reconstruir la URL. Se descartó porque duplicaría un valor que ya vive en la configuración de build (`--base-href=/poker-planning/` en `deploy-web.yml`) y en modo local (`base-href` vacío) sería otro valor distinto — usar `window.location.href` es correcto en ambos casos sin configuración adicional.

### Decisión 2: Redirección con query param `room`, detectada en `RoomPage.constructor()`
`RoomPage` ya tiene acceso a `roomIdFromUrl` (vía `ActivatedRoute`). Se agrega una verificación: si no hay sesión guardada en `sessionStorage` para esa sala (misma condición que hoy hace que `rejoinIfNeeded` no haga nada), se navega a `/` con `queryParams: { room: roomIdFromUrl }` en vez de quedarse esperando.

Se expone un método público en `RoomSocketService` (o se verifica directamente el contenido de `sessionStorage` desde `RoomPage`, a decidir en implementación cuál es menos invasivo) para saber si existe sesión guardada para un `roomId` dado, sin duplicar la lógica de parseo que ya vive en `rejoinIfNeeded`.

**Alternativa descartada**: pasar el `roomId` vía Router state (`router.navigate(['/'], { state: { roomId } })`) en vez de query param. Se descartó por decisión explícita del usuario — el query param deja la URL de redirección (`/?room=ABC123`) inspeccionable/bookmarkeable, y es coherente con que el link *original* que comparte el moderador siga siendo la URL limpia (`/room/ABC123`); el query param es un detalle interno de la redirección, no algo que se comparte directamente.

### Decisión 3: Home lee el query param `room` al inicializar y dispara la misma consulta que el blur manual
En el constructor/inicialización de `Home`, se lee `route.snapshot.queryParamMap.get('room')`. Si está presente:
- Se fuerza `mode.set('join')` (aunque ya sea el default, por robustez si alguna vez cambia).
- Se precarga `joinRoomId` con el valor (normalizado a mayúsculas, igual que hace `joinRoom()` al enviar).
- Se dispara la misma lógica que hoy corre en `onJoinRoomIdBlur()` (`connect()` + `send({ action: 'getRoomInfo', roomId })`), para que si la sala tiene un grupo de íconos asignado, el selector aparezca precargado sin que el usuario tenga que tocar el campo manualmente (hoy ese trigger depende de un evento `blur`, que no ocurre si el campo ya viene lleno sin que el usuario interactúe con él).

Se extrae la lógica compartida por `onJoinRoomIdBlur()` y este nuevo camino a un método privado común, para no duplicarla.

### Decisión 4: Redirección ocurre antes de intentar mostrar cualquier UI de "sala", no como fallback tras timeout
La redirección se decide sincrónicamente en el constructor de `RoomPage`, comparando contra `sessionStorage` (operación local, instantánea) — no se espera ningún timeout de red ni respuesta del servidor. Esto evita el parpadeo de mostrar "Conectando a la sala..." brevemente antes de redirigir, y evita cualquier ambigüedad con el caso legítimo de "tengo sesión pero el WebSocket tarda en responder" (que sigue su curso normal, sin redirigir).

## Risks / Trade-offs

- [Riesgo] Si `sessionStorage` está deshabilitado en el navegador del usuario (modo privado estricto, políticas corporativas), todo intento de reconexión —incluso legítimo— se comportaría como "sin sesión" y redirigiría a Home en cada recarga → Aceptado; es el mismo comportamiento que ya existe hoy para la reconexión normal (`rejoinIfNeeded` ya depende de `sessionStorage`), no una regresión introducida por este cambio.
- [Riesgo] Si el usuario edita manualmente la URL para agregar `?room=X` a la ruta de Home después de haber sido redirigido, y luego navega hacia atrás, podría ver un comportamiento de historial de navegador un poco confuso (dos entradas: `/room/X` y `/?room=X`) → Aceptado como trade-off menor; no se usa `replaceUrl` para mantener el comportamiento simple, a menos que se decida lo contrario en implementación.

## Migration Plan

Sin datos ni usuarios afectados — cambio de comportamiento del cliente, sin migración de estado. Pasos:
1. Corregir `shareLink`.
2. Agregar la detección de "sin sesión" y redirección en `RoomPage`.
3. Agregar la lectura del query param en `Home`, reutilizando la lógica de `onJoinRoomIdBlur()`.
4. Verificar manualmente contra producción (o backend local): crear una sala, copiar el `shareLink` mostrado, abrirlo en una pestaña sin sesión — debe llegar a Home con el código precargado y (si aplica) el selector de íconos ya visible.
5. Verificar que el caso de reconexión con sesión previa (recargar estando dentro de una sala) sigue funcionando sin redirigir.

## Open Questions

Ninguna bloqueante. A confirmar en implementación: si exponer un método en `RoomSocketService` para verificar sesión existente, o leer `sessionStorage` directamente desde `RoomPage` (decisión de organización de código, sin impacto funcional).
