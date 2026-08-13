# Tareas — Tests donde vive la lógica de dominio

> **El orden importa.** Los grupos 1 y 2 no necesitan ninguna infraestructura de test:
> son funciones puras. Recién el grupo 3 introduce el mockeo del SDK de AWS.
>
> **Los casos de los dos changes archivados se escriben leyendo el change, no el código.**
> Ahí está la regla enunciada; en el código está lo que hace hoy, que es lo que queremos
> verificar, no lo que queremos copiar.

## 1. Extraer la función de dominio

- [x] 1.1 Mover `computeRevealResult` y su ayudante `toNumeric` de `apps/realtime-api/src/actions/reveal.ts` a `apps/realtime-api/src/lib/reveal-result.ts`, exportando la primera.
- [x] 1.2 Confirmar que el diff **solo** muestra el movimiento y el `export`. Si aparece cualquier otro cambio de lógica, revertir y rehacer: esto es un movimiento, no un refactor.
- [x] 1.3 `nx build realtime-api` y `nx lint realtime-api` en verde.
- [x] 1.4 Correr los e2e (`npm run test:e2e:ci`) y confirmar los 13 en verde. Cubren el revelado de punta a punta, así que son la red de seguridad de este movimiento.

## 2. Las dos funciones puras

- [x] 2.1 `reveal-result.spec.ts` — **distribución**: cuenta cada valor votado, incluidos los no numéricos.
- [x] 2.2 `reveal-result.spec.ts` — **promedio**: se redondea a un decimal, e ignora los votos que no son numéricos.
- [x] 2.3 `reveal-result.spec.ts` — **promedio con escala de mazo**: se ajusta al valor más cercano de la escala por distancia lineal. Es el caso de `2026-07-19-tshirt-numeric-resolution`.
- [x] 2.4 `reveal-result.spec.ts` — **moda**: el valor más votado; con empate devuelve todos los empatados.
- [x] 2.5 `reveal-result.spec.ts` — **moda no numérica**. **Corregido al leer el change**: `2026-07-11-fix-mode-numeric-only` NO toca `computeRevealResult`. La moda de un grupo que votó mayoritariamente `☕` **es** `☕`, y eso es correcto; lo que ese change agregó es que no se pueda *resolver* la historia con ese valor, y esa defensa vive en `handleResolveStory`. Se testea la moda no numérica acá, y la defensa en 5.6.
- [x] 2.6 `reveal-result.spec.ts` — **sin votos**: promedio nulo y moda vacía, sin excepción.
- [x] 2.7 `room-repository.spec.ts` — `maskRoomForViewer` **oculta** los votos ajenos cuando la ronda no está revelada, y **conserva** el voto propio del que mira.
- [x] 2.8 `room-repository.spec.ts` — `maskRoomForViewer` **no oculta nada** cuando la ronda está revelada.
- [x] 2.9 `room-repository.spec.ts` — un participante que no votó se ve como `null`, no como `'hidden'`. La diferencia importa: la interfaz distingue "no votó" de "votó en secreto".
- [x] 2.10 **Sacar `"passWithNoTests": true`** de `apps/realtime-api/project.json` y confirmar que `nx test realtime-api` sigue en verde con los tests nuevos.

## 3. Montar el mockeo del SDK

- [x] 3.1 Agregar `aws-sdk-client-mock` como devDependency.
- [x] 3.2 Escribir un primer test de `reveal` que solo verifique el camino feliz, para validar que el patrón `mockClient(DynamoDBDocumentClient).on(GetCommand).resolves(...)` funciona en este workspace.
- [x] 3.3 Si mockear resulta difícil, **parar y mirar el diseño** antes de forzarlo: esa dificultad suele ser señal de acoplamiento mal puesto en el código, no de un problema del test.

## 4. Handler `reveal`

- [x] 4.1 Camino feliz: el moderador revela con una historia asignada → se escribe `roundPhase: 'revealed'` con el resultado calculado, y se difunde.
- [x] 4.2 Camino de error — **sala inexistente**: responde `Room not found` y no escribe nada.
- [x] 4.3 Camino de error — **no es el moderador**: responde `Only the moderator can reveal votes` y no escribe nada.
- [x] 4.4 Camino de error — **sin historia asignada**: responde `No story assigned yet` y no escribe nada.
- [x] 4.5 Confirmar que en los tres caminos de error **no** hay `UpdateCommand`. Que no escriba es tan parte de la regla como el mensaje.

## 5. Handlers `vote` y la defensa de `resolve-story`

- [x] 5.1 Leer `vote.ts` y enumerar sus reglas antes de escribir el primer test.
- [x] 5.2 Camino feliz: un participante votante emite su voto y queda registrado.
- [x] 5.3 ~~Camino de error: votar cuando el estado de la ronda no lo permite.~~ **No existe esa validación**: el servidor acepta votos después del revelado. Queda como `it.todo` y en known-issues, porque el spec no dice cuál debería ser la regla.
- [x] 5.4 ~~Camino de error: votar siendo moderador no-votante.~~ **No existe esa validación**, y acá el spec sí la exige (*"participante habilitado para votar"*). Es un hueco real, anotado en known-issues con el precedente de fix-mode-numeric-only.
- [x] 5.5 Votar dos veces: confirmar cuál es el comportamiento real —pisa el voto anterior o lo rechaza— y **especificarlo en el test**. Si el código y `estimation-session` no coinciden, parar: es un hallazgo, no un detalle.

- [x] 5.6 `resolve-story.spec.ts` — **la defensa de `2026-07-11-fix-mode-numeric-only`**: resolver con un `finalScore` no finito responde error y no escribe nada. Es el único test fuera del alcance declarado en el proposal, y entra porque cierra uno de los dos bugs que motivan el change. Descubierto al hacer 2.5.
- [x] 5.7 `resolve-story.spec.ts` — camino feliz y permiso denegado, que vienen casi gratis con el mock ya montado.

## 6. Cierre

- [x] 6.1 `nx test realtime-api` en verde, y confirmar en el log que **corrió tests de verdad** (no un `passWithNoTests` disfrazado).
- [x] 6.2 Verificar el negativo: romper una aserción a propósito, confirmar que el target falla, y revertir.
- [x] 6.3 `docs/hardening-roadmap.md`: **corregir la Fase 2.1** — dice de empezar por `resolve-story` por el promedio y la moda, y esa acción no calcula nada; el cálculo está en `reveal`.
- [x] 6.4 `docs/hardening-roadmap.md`: anotar la segunda vuelta con las 8 acciones restantes y que el patrón de mockeo ya está montado.
- [x] 6.5 Anotar en el roadmap que la Fase 2.3 (umbral de cobertura) conviene fijarla **después** de la segunda vuelta, no ahora: el trinquete se fija en el valor alcanzado, y con dos handlers cubiertos mediría poco.
