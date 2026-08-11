# Lecciones aprendidas escribiendo la suite e2e

Notas prácticas recogidas durante la implementación de `add-e2e-estimation-rules-coverage` y `add-e2e-room-moderation-coverage` (los dos changes que agregaron Page Objects/fixtures y ampliaron la cobertura más allá del flujo feliz original). Pensado como referencia rápida antes de escribir el próximo test e2e o de diagnosticar uno que falla sin motivo aparente.

## Selectores: lo que el DOM realmente expone no siempre coincide con lo esperado

- **El formulario de "Crear sala" arranca oculto.** El tab por defecto en Home es "Unirse a sala" (`mode() === 'join'`), no "Crear sala". Cualquier `HomePage.createRoom()` necesita un primer click en el tab antes de poder llenar el formulario — omitir ese click deja el `fill()` corriendo contra un campo que no existe todavía, y falla en silencio o con un timeout confuso más adelante.

- **`title` no siempre es el accessible name.** El botón "Nueva ronda" tenía `title="Nueva ronda"` y contenido de texto visible ("↻"). Cuando ambos están presentes, el contenido de texto gana en el cálculo de accessible name, así que `getByRole('button', { name: 'Nueva ronda' })` no lo encontraba y el selector tuvo que caer a `page.locator('button.reveal-panel__new-round')`.

  **Resuelto** en el change `fix-room-ui-accessibility` (2026-08-10): el botón ahora tiene `aria-label="Nueva ronda"` y el selector volvió a `getByRole`. La lección que sobrevive es la regla general —el contenido de texto gana sobre `title`—, no el workaround.

  El patrón que dejó esto: **cuando un selector por rol no funciona, la primera pregunta es si el problema es del test o de la accesibilidad de la app.** Acá era de la app. Un `getByRole` que no encuentra nada suele ser un lector de pantalla que tampoco va a encontrar nada.

- **Un checkbox visualmente invisible no es clickeable directamente.** El toggle "moderador vota" usa el patrón estándar de switch custom: `<input type="checkbox">` con `opacity:0; width:0; height:0`, envuelto en un `<label>` que es el elemento realmente interactivo. Playwright rechaza correctamente un click directo sobre el `input` ("element is not visible") — hay que clickear el `<label>`.

- **Un control que no se puede seleccionar por rol probablemente tampoco se puede usar con teclado.** La resolución de historia con el voto de un participante estaba implementada como un `<li>` con `(click)`, sin rol de botón. El selector tuvo que caer a `locator('li.reveal-panel__vote--clickable', { hasText: name })`, y en su momento se documentó como una desviación aceptable del testing.

  **Era un bug del producto, no una particularidad del test**: ese `<li>` no era focusable ni respondía a Enter, así que la función era inaccesible con teclado. Se corrigió en `fix-room-ui-accessibility` (2026-08-10) convirtiéndolo en `<button>`, y el selector es ahora `getByRole('button', { name: \`Usar el voto de ${name}\` })`.

  **La lección corregida**: cuando un `getByRole` no encuentra un control, no documentes el workaround — investigá por qué el control no tiene rol. Dos veces en este repo la respuesta fue "porque está mal construido".

- **Controles ausentes vs. deshabilitados no son lo mismo.** Los controles de moderación (Revelar votos, panel de resolución, Nueva ronda) no se deshabilitan para un no-moderador ni sin historia asignada — directamente no se renderizan (`@if` en el template). Los asserts correctos son `toHaveCount(0)`, no `toBeDisabled()`.

## Verificar supuestos de la UI contra el código, no contra la intuición

- El checkbox "Quiero votar como moderador" está **tildado por defecto** al crear una sala (`moderatorIsVoter = true` en `home.ts`). Un test escrito asumiendo lo contrario ("el moderador activa el voto") fallaba de forma consistente — no por un bug de Playwright, sino porque el escenario partía de una premisa incorrecta. La corrección fue ajustar el test a la realidad (desmarcar y volver a marcar), no forzar el comportamiento de la app.

- Cuando el mensaje final de una historia resuelta con un mazo de escala interna (T-Shirt Sizes) se muestra al usuario, la UI convierte el número interno de vuelta a la etiqueta de mazo (`valueLabel()` en `room.ts`) — el texto dice "resuelta con M pts", no "resuelta con 4 pts", aunque el valor persistido internamente sí sea 4. Un assert ingenuo sobre el número crudo falla aunque el comportamiento sea completamente correcto.

**Lección general**: antes de escribir el assert, leer el componente real (no solo el spec de requirements) para confirmar qué texto/atributo se muestra de verdad. El spec describe el comportamiento observable a alto nivel; los detalles de presentación (qué etiqueta exacta, qué selector) solo están en el código.

## `nx serve` no es la única forma de levantar las apps para Playwright

**Registrado el 2026-08-11, armando el job de e2e en CI (change `add-e2e-to-ci`).**

Durante mucho tiempo este repo dio por sentado que la suite **no podía** levantar su propio entorno. La razón era real pero se generalizó de más: poner `nx serve realtime-api` / `nx serve web` dentro de `webServer.command` choca con el `dependsOn` que el plugin `@nx/playwright` infiere **a partir de ese mismo comando**, y termina en `Recursive task invocation detected`.

La conclusión correcta no era "no se puede orquestar" sino "**no se puede orquestar con `nx serve`**". Las dos apps se levantan sin él:

| App | Comando | Por qué no choca |
|---|---|---|
| `web` | `npx nx run web:serve-static` | `@nx/web:file-server` con `spa: true`. Buildea y sirve con fallback SPA. Es el comando que los generadores de `@nx/playwright` emiten por defecto, y `serve-static` está marcado `continuous: true` — el mecanismo que Nx tiene justamente para esto. |
| `realtime-api` | `node dist/apps/realtime-api/main.js` | Es un `ws` plano: no hay nada que "servir". Y un comando que no empieza con `nx` es **opaco** para la inferencia del plugin. |

Verificado: los 12 tests activos corren desde cero, sin recursión, en ~22s con 8 workers.

**Dos detalles que cuestan tiempo si no se saben:**

- **`serve-static` escucha solo en `[::1]:4200`**, no en `127.0.0.1`. El `baseURL` tiene que ser `localhost`; forzar IPv4 no conecta. Es el reflejo exacto del problema inverso de DynamoDB Local, donde `localhost` resuelve a IPv6 y el contenedor no responde (ver `known-issues.md`).
- **Para el backend se espera por `port`, no por `url`.** Es un WebSocket: no hay status HTTP que chequear, y esperar por puerto evita depender de qué contesta a un GET.

## Diagnóstico de fallos intermitentes en el entorno local

Esta fue la parte que más tiempo tomó y la que más vale la pena releer antes de asumir que un test es "flaky" o que hay un bug real en la app.

### Un `docker restart` sin recrear la tabla rompe todo silenciosamente

`docker restart dynamodb-local` deja el contenedor "corriendo" pero borra los datos en memoria — incluida la tabla `poker-planning-rooms`. El backend (`realtime-api`) no valida esto al arrancar: recién crashea con `ResourceNotFoundException: Cannot do operations on a non-existent table` en el primer intento real de conexión de un test, mucho después de haber arrancado limpio y mostrado "Local WebSocket dev server listening on ws://localhost:3001". El proceso queda además en estado "waiting for changes to restart" (el watch de Nx no reintenta solo).

**Consecuencia práctica**: si reiniciaste el contenedor de DynamoDB Local por cualquier motivo durante una sesión de diagnóstico, correr `npm run dev:db:create-table` de nuevo es obligatorio antes de confiar en cualquier resultado de test posterior. `npm run e2e:db:up` (que sí crea la tabla) solo cubre el caso de `docker start`/`docker run`, no el de `docker restart`.

### `TaskStop` (o Ctrl+C) no siempre mata los procesos hijos reales de `nx serve` en Windows

Varias veces durante la implementación, detener el proceso en background que corría `npm run dev:api` dejaba un proceso Node zombie con el puerto 3001 (y el inspector 9229) todavía bindeados. El síntoma en la siguiente corrida era `EADDRINUSE`, o peor: el nuevo proceso arrancaba, pero las conexiones WebSocket del navegador se iban silenciosamente al proceso zombie en vez de al nuevo.

**Cómo detectarlo de forma confiable**: `netstat -ano` desde Git Bash en Windows no siempre reporta correctamente sockets en `[::1]`/IPv6. La forma confiable fue PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 3001,9229 -State Listen -ErrorAction SilentlyContinue
```

Y para matarlo:

```powershell
$pids = (Get-NetTCPConnection -LocalPort 3001,9229 -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
```

### Ejecutar `E2E_TARGET=aws` con un `web` local ya corriendo prueba silenciosamente contra local, no contra AWS

`playwright.config.mts` usa `reuseExistingServer: true` en el `webServer` del modo AWS. Si ya hay un `nx serve web` local sirviendo en el puerto 4200 (modo development, apuntando a `ws://localhost:3001`), Playwright lo reutiliza tal cual en vez de levantar `web --configuration=aws`. Los tests "pasan" en segundos (sospechosamente rápido para latencia real de AWS) pero en realidad nunca tocaron el stack real. **Antes de correr el modo AWS, confirmar que el puerto 4200 está libre.**

### Repetir la misma suite muchas veces seguidas en el mismo proceso backend degrada los resultados

Durante el diagnóstico, correr la suite completa repetidamente (con distintos niveles de paralelismo, con y sin `--trace`) contra el mismo proceso `realtime-api`/DynamoDB Local sin reiniciar nada terminó produciendo resultados cada vez más inconsistentes — de "13/13 pasan" a "13/13 fallan" y de vuelta, sin cambios de código entre medio. Reiniciar limpio (matar el proceso, recrear la tabla, arrancar de cero) y correr **una sola vez** fue lo que permitió distinguir señal de ruido.

**Lección**: cuando un test falla de forma que no se explica por su propia lógica, la primera sospecha razonable no es "hay un bug sutil en el test" sino "¿está el entorno realmente limpio ahora mismo?". Reiniciar todo y correr una sola vez da más información que reintentar 10 veces sobre un entorno ya degradado.

### Algunos fallos siguen siendo genuinamente intermitentes incluso con entorno limpio

Con `--workers=8` (el default), 1-2 tests de 13 fallan de forma no determinística incluso arrancando de un backend/DB completamente frescos — típicamente los tests que abren un tercer `BrowserContext` (reconexión, desconexión), que suman más carga de arranque de Chromium por test. Reducir la concurrencia no lo arregla de forma confiable (en una prueba, `--workers=3` produjo *peores* resultados que `--workers=8`, probablemente por otra causa distinta acumulada en el momento). Esto se aceptó como el mismo tipo de riesgo ya documentado para la latencia de AWS: limitación conocida del entorno de test, no un defecto a perseguir indefinidamente dentro de un change de testing.

Un caso particular (`reconexión automática restaura el voto`) resultó reproducible incluso con `--workers=1` en una sesión posterior, sin explicación encontrada — se dejó marcado con `test.fixme()` en vez de forzar una corrección sin evidencia sólida, documentado en `docs/known-issues.md` con pasos de reproducción manual para confirmar si es un bug real de la app o un problema puntual del entorno de esa máquina.

## Recomendaciones para el próximo test/change de e2e

1. Antes de escribir el escenario, leer el componente Angular real (`.html` + `.ts`) del elemento a interactuar — no asumir el selector ni el texto mostrado desde el spec de requirements.
2. Si algo falla con `waitForURL` o similar justo después del primer paso (crear/unirse a sala), sospechar del entorno (tabla faltante, puerto ocupado, proceso zombie) antes que de la lógica del test.
3. Reiniciar limpio y correr una sola vez para diagnosticar — no acumular corridas de diagnóstico sobre el mismo proceso backend.
4. Documentar cualquier selector no obvio (clase CSS en vez de rol ARIA, click en `label` en vez de `input`) con un comentario corto explicando el porqué, para que el próximo test no repita la misma investigación.
5. Si un fallo resulta genuinamente intermitente sin causa raíz clara tras un esfuerzo razonable de diagnóstico, usar `test.fixme()` y documentar en `known-issues.md` en vez de forzar un ajuste sin evidencia (ampliar timeouts a ciegas, agregar retries) que solo esconde el síntoma.
