# Tareas — El servidor deja de confiar en la interfaz

> **Antes de cada acción, enumerar sus reglas leyendo el spec.** El riesgo de escribir
> ocho archivos de test seguidos es hacerlo en piloto automático, copiando lo que el
> código hace en vez de afirmar lo que debería hacer.
>
> El patrón de mockeo ya está montado en `reveal.spec.ts` desde la primera vuelta.

## 1. Las dos guardas de `handleVote`

- [x] 1.1 Agregar la guarda de `isVoter`: rechazar el voto de un participante no habilitado como votante. Requiere leer el participante, que hoy `handleVote` no hace — mirar cómo lo resuelve `set-moderator-is-voter`, que ya consulta ese estado.
- [x] 1.2 Agregar la guarda de fase: rechazar el voto cuando `roundPhase` ya es `revealed`.
- [x] 1.3 Reemplazar los dos `it.todo` de `vote.spec.ts` por tests reales, verificando el mensaje **y** que no haya escritura.
- [x] 1.4 Confirmar que los tests ya existentes de `vote.spec.ts` siguen en verde — sobre todo el de cambiar el voto antes del revelado, que la guarda de fase **no** debe bloquear.
- [x] 1.5 Correr los 13 e2e. Recorren votar → revelar → nueva ronda → resolver, así que son la red que detecta si alguna guarda rompe un flujo real.

## 2. `join-room` — la de más contenido

- [x] 2.1 Enumerar sus reglas antes de escribir: alta de participante nuevo, vuelta de uno desconectado, nombre en uso, validación de ícono.
- [x] 2.2 Alta de un participante nuevo: queda como votante, no moderador, sin voto.
- [x] 2.3 **Reconexión**: quien vuelve conserva su voto, su rol de moderador y su ícono. Es lo que cubría el e2e que estuvo marcado `test.fixme` doce días.
- [x] 2.4 Nombre en uso **con el original conectado**: se rechaza con `name-taken`.
- [x] 2.5 Nombre en uso **con el original desconectado**: se acepta, porque es una reconexión y no una colisión. La diferencia está en un solo `&& existing.connected`.
- [x] 2.6 Sala inexistente: se rechaza con `room-not-found`.
- [x] 2.7 Ícono que no pertenece al grupo de la sala: se descarta y queda en `null`.

## 3. `set-moderator-is-voter`

- [x] 3.1 Camino feliz: el moderador cambia su estado de votante.
- [x] 3.2 Rechaza si quien pide no es el moderador.
- [x] 3.3 Rechaza **durante una ronda activa** (`Cannot change voter status while a round is active`). Mirarlo junto con la guarda del grupo 1: las dos protegen el mismo estado y no deberían contradecirse.
- [x] 3.4 Rechaza si la sala no existe.

## 4. Las cinco mecánicas

- [x] 4.1 `create-room` — la sala queda con el moderador como participante, y el ícono se valida contra el grupo del mazo.
- [x] 4.2 `new-round` — descarta los votos de la ronda; rechaza si no es el moderador o si la sala no existe.
- [x] 4.3 `next-story` — registra el avance; rechaza si no es el moderador o si la sala no existe.
- [x] 4.4 `close-room` — produce el resumen; rechaza si no es el moderador o si la sala no existe.
- [x] 4.5 `resolve-story` — completar lo que faltó de la primera vuelta: que la ronda vuelva a `idle`, que se limpie `currentStoryTitle` y que se reseteen los votos.

## 5. `get-room-info`

- [x] 5.1 Sala inexistente: responde `room-not-found`.
- [x] 5.2 **Que no filtre de más**: la respuesta contiene exactamente `roomId`, `deckId` e `iconGroupId` — ni participantes, ni votos, ni el nombre del moderador. Es el único endpoint llamable **sin estar en la sala**, así que quien conoce el código no debería poder averiguar quién está adentro. Enumerar las claves de la respuesta, no solo comprobar las tres que interesan.

## 6. Cierre

- [x] 6.1 `nx test realtime-api` en verde, sin ningún `todo` pendiente.
- [x] 6.2 Verificar el negativo: romper una aserción de una acción nueva, confirmar el rojo, revertir.
- [x] 6.3 `docs/known-issues.md`: cerrar la entrada *"El servidor no valida quién está habilitado para votar"* — las dos mitades quedaron resueltas, y la segunda además quedó especificada.
- [x] 6.4 `docs/hardening-roadmap.md`: cerrar la Fase 2.1 completa y anotar qué se encontró en la segunda vuelta.
- [x] 6.5 Anotar que la Fase 2.3 (umbral de cobertura) ya tiene sobre qué fijarse, que era lo que faltaba.
