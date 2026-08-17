# Diseño — El servidor deja de confiar en la interfaz

## Context

La primera vuelta dejó `reveal`, `vote` y la defensa de `resolve-story` cubiertos, y encontró dos huecos que quedaron anotados como `it.todo`:

```
  handleVote  ├─ ¿hay nombre en la conexión?     ✓ valida
              ├─ ¿existe la sala?                ✓ valida
              ├─ ¿hay historia asignada?         ✓ valida
              ├─ ¿quien vota es votante?         ✗ hueco 1
              └─ ¿la ronda todavía acepta votos? ✗ hueco 2
```

Verificado en la web antes de escribir esto — **los dos ya se cumplen en la interfaz**:

```html
@if (roundPhase === 'revealed') { ...panel de revelado... }
@else if (currentStoryTitle)    { <app-voting-board
                                     [disabled]="!myParticipant()!.isVoter" ... /> }
```

El mazo no se pinta cuando la ronda está revelada, y va deshabilitado para quien no es votante. O sea que **ningún usuario puede provocar esto usando la aplicación**. El agujero se abre para cualquier otra cosa que hable el mismo protocolo: un cliente viejo con una pestaña abierta, una reconexión con estado desfasado, o una regresión futura en la web.

Estado del resto de las acciones:

| Acción | Reglas propias |
|---|---|
| `join-room` | Reconexión (preserva voto, rol e ícono), nombre en uso, validación de ícono |
| `set-moderator-is-voter` | No se puede cambiar durante una ronda activa |
| `create-room` | Validación del ícono contra el grupo del mazo |
| `new-round`, `next-story`, `close-room` | Permiso del moderador + transición |
| `get-room-info` | Solo "sala no encontrada" — pero es el único endpoint accesible sin estar en la sala |

## Goals / Non-Goals

**Goals:**

- Que las dos reglas de votación las haga cumplir el servidor, no la interfaz.
- Que la segunda de ellas quede **escrita** en el spec, porque hoy no está en ningún lado.
- Cerrar la cobertura de las 8 acciones restantes.
- Dejar la Fase 2.1 completa, para poder fijar el umbral de cobertura (2.3) sobre algo real.

**Non-Goals:**

- **Cambios en la web.** Ya cumple las dos reglas.
- **Fase 2.2 y 2.3.**
- **Refactorizar los handlers.** La primera vuelta extrajo `computeRevealResult` porque era una función pura escondida; en el resto no hay nada equivalente.

## Decisions

### Decisión 1: las dos guardas van en este change, no en uno propio

Son un cambio de comportamiento mezclado con un change de tests, y eso normalmente se separa.

**Elegido**: van juntas.

El `it.todo` que las documenta **ya está escrito** en `vote.spec.ts` desde la primera vuelta: cerrarlas es reemplazar dos `todo` por dos tests. Separarlas obligaría a abrir un change para cinco líneas de guarda, y dejaría el `todo` colgado mientras tanto — que es justo el estado que la primera vuelta quiso evitar al no fijar el hueco con un `expect`.

Además el propósito real de esta fase nunca fue "agregar tests" sino **cerrar huecos de dominio**; los tests son cómo se encuentran.

### Decisión 2: las dos reglas no son iguales, y se tratan distinto

Esta es la distinción que ordena el change.

| | `isVoter` | Votar tras el revelado |
|---|---|---|
| ¿El spec la exige? | **Sí** — *"cada participante habilitado para votar"* | **No dice nada** |
| Qué es el arreglo | **Conformidad**: el código no cumplía lo escrito | **Decisión nueva**: había que elegir |
| Qué hace falta | Solo la guarda | La guarda **y** escribirlo en el spec |

Confundirlas llevaría a dos errores opuestos: tratar la primera como decisión abierta —cuando ya estaba decidida— o meter la segunda sin dejar registro de que se eligió.

**Sobre la segunda**: se decide **rechazar**. El voto tras el revelado no aporta —los demás ya vieron todo, así que el sesgo de anclaje que el juego intenta evitar ya ocurrió— y `new-round` existe precisamente para volver a abrir la votación. Queda escrito en `estimation-session`, para que el próximo que lea el código no tenga que deducirlo.

### Decisión 3: `get-room-info` entra, aunque no tenga reglas de negocio

Tiene 25 líneas y una sola guarda. Por valor de reglas, es la más pobre de las ocho.

**Elegido**: entra igual, por una razón distinta a las demás.

Es el **único endpoint que se puede llamar sin estar en la sala** — la pantalla de ingreso lo usa para saber qué mazo dibujar antes de que nadie se una. Y devuelve exactamente tres campos:

```ts
{ type: 'roomInfo', roomId, deckId, iconGroupId }
```

Ni participantes, ni votos, ni el nombre del moderador. Eso no es casualidad, es la propiedad que hay que fijar: **quien conoce el código de una sala no debería poder averiguar quién está adentro** sin unirse. Un test que enumere el contenido de la respuesta convierte esa propiedad en algo que se rompe con ruido si alguien agrega un campo de más.

### Decisión 4: el orden va por valor de reglas, no por tamaño

**Elegido**: `join-room` y `set-moderator-is-voter` primero.

`join-room` es la de más contenido: la lógica de reconexión —preservar voto, rol e ícono de quien vuelve— es lo que cubría el e2e que estuvo doce días marcado `test.fixme`. Un unitario lo prueba con precisión y en milisegundos, sin depender de cerrar y reabrir pestañas.

`set-moderator-is-voter` va segunda porque toca el mismo estado que la guarda nueva: ya protege `isVoter` de cambios durante una ronda activa. Verlas juntas evita dejar una inconsistencia entre las dos.

El resto —`create-room`, `new-round`, `next-story`, `close-room`, `resolve-story`, `get-room-info`— comparten forma y salen mecánicas con el patrón ya montado.

## Risks / Trade-offs

**[Las guardas nuevas rompen un flujo real que no vimos]** → La interfaz ya impide las dos cosas, así que ningún uso normal debería toparse con ellas. Mitigación: los 13 e2e recorren el flujo completo —votar, revelar, nueva ronda, resolver— y corren en el mismo pull request.

**[La reconexión resulta más sutil de lo que parece]** → `join-room` mezcla el alta de un participante nuevo con la vuelta de uno que se cayó, y la diferencia está en un `existing?.x ?? default` repetido cuatro veces. Si al testearlo aparece un caso que el código no contempla, es un hallazgo y hay que anotarlo, no acomodarlo.

**[Ocho archivos de test de una vez]** → El riesgo es escribirlos en piloto automático, copiando lo que el código hace en vez de afirmar lo que debería hacer. Mitigación: antes de cada acción, enumerar sus reglas leyendo el spec, igual que en la primera vuelta.

## Migration Plan

1. Las dos guardas en `handleVote`, reemplazando los `it.todo` por tests.
2. `join-room` y `set-moderator-is-voter`.
3. Las cinco restantes más `get-room-info`.
4. Cerrar la entrada de `known-issues.md` y la Fase 2.1 del roadmap.

**Rollback**: revertir el commit. Las guardas no dejan estado.

## Open Questions

Ninguna. Las dos reglas de votación quedaron decididas: se rechaza en los dos casos.
