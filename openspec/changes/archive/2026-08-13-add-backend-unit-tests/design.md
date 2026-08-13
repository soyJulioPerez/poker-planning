# Diseño — Tests donde vive la lógica de dominio

## Context

Los 10 handlers de `apps/realtime-api/src/actions/` tienen todos la misma forma:

```
  handleX(apiEndpoint, connectionId, request)
    ├─ leer la conexión → nombre del participante      DynamoDB
    ├─ leer la sala → error si no existe               DynamoDB
    ├─ ¿quien pide es el moderador?                  ← REGLA
    ├─ ¿el estado permite esta acción?               ← REGLA
    ├─ calcular el resultado                         ← REGLA
    ├─ escribir                                        DynamoDB
    └─ reconstruir y difundir                          API Gateway
```

Tres pasos son reglas de negocio; cuatro son plomería. **El costo de testear está en la plomería, y el valor está en las reglas.**

Estado verificado antes de escribir esto:

| | |
|---|---|
| Tests en `realtime-api` | 0 |
| `passWithNoTests` | `true` |
| Runner | Jest, igual que `packages/` y `mobile` |
| Líneas en `actions/` | 648 |
| Funciones puras existentes | `computeRevealResult` (sin exportar), `maskRoomForViewer`, `toParticipant` |

## Goals / Non-Goals

**Goals:**

- Cubrir las reglas que **ya se rompieron una vez**, con los casos de los dos changes archivados escritos explícitamente.
- Cubrir la regla que hace que el producto funcione como juego: que nadie vea votos ajenos antes del revelado.
- Que el target de test falle si no hay tests.
- Dejar el patrón de mockeo montado y documentado, para que la segunda vuelta sea mecánica.

**Non-Goals:**

- **Las otras 8 acciones** — segunda vuelta.
- **Integración contra DynamoDB Local** — Fase 2.2.
- **Umbral de cobertura** — Fase 2.3.
- **Testear a través de los handlers HTTP** (`connect`, `disconnect`, `default`). Son adaptadores finos; la lógica está en `actions/`.

## Decisions

### Decisión 1: empezar por las funciones puras, no por los handlers

El roadmap dice *"empezar por `resolve-story` — promedio, moda, resolución manual"*. **Eso es incorrecto y conviene corregirlo en el documento.**

`resolve-story.ts` no calcula nada: recibe `finalScore` del cliente y lo guarda. Su única regla es `Number.isFinite`. El promedio y la moda están en `reveal.ts`.

**Elegido**: arrancar por `computeRevealResult` y `maskRoomForViewer`.

```
  computeRevealResult(votos, escala)  →  { distribución, promedio, moda }
  maskRoomForViewer(sala, quién)      →  sala con los votos ajenos ocultos
```

Las dos son **puras**: entra un objeto, sale otro, sin tocar nada externo. No necesitan mocks, ni configuración, ni infraestructura. Se puede tener el primer test en verde antes de decidir cómo mockear DynamoDB.

Y son las que más cubren por línea escrita: los dos bugs archivados viven en la primera, y la segunda es lo que impide que el planning poker se convierta en votación a mano alzada.

### Decisión 2: `computeRevealResult` se extrae a `lib/`, no se exporta en su lugar

Hoy vive dentro de `reveal.ts`, sin exportar, arriba del handler que habla con DynamoDB.

La opción mínima sería agregarle `export`. Se descarta por dos razones:

**Un test de una función pura no debería arrastrar el adaptador.** Importar `reveal.ts` trae `dynamo-client`, `room-repository` y `broadcast` con él. Hoy eso no falla —construir el cliente de DynamoDB no hace I/O— pero es una dependencia gratuita que no aporta nada y que puede morder más adelante.

**Es donde corresponde.** `lib/` ya tiene las otras piezas de dominio compartidas: `reset-votes.ts`, `room-id.ts`. La función es un cálculo del dominio, no una preocupación del adaptador.

**Elegido**: mover a `apps/realtime-api/src/lib/reveal-result.ts`, **sin tocar una línea de la lógica**. Es un movimiento, no un refactor: si el diff muestra algo más que el cambio de archivo y el `export`, algo salió mal.

Efecto lateral que vale: la separación entre regla y adaptador deja de estar implícita y pasa a estar en la estructura de carpetas.

### Decisión 3: `aws-sdk-client-mock` para los handlers

Para testear `reveal` y `vote` hay que interceptar las llamadas a DynamoDB. Dos caminos:

| | |
|---|---|
| `jest.mock('../lib/dynamo-client')` | Sin dependencias nuevas. Hay que reimplementar a mano el comportamiento de `send()` según el comando que reciba, y se vuelve frágil apenas hay más de dos llamadas distintas. |
| **`aws-sdk-client-mock`** | Es **la** librería estándar para el SDK v3 de AWS. `mockClient(DynamoDBDocumentClient).on(GetCommand).resolves({ Item: ... })` — se declara por comando, que es exactamente el grano que necesitan estos handlers. |

**Elegido**: `aws-sdk-client-mock`.

Es una devDependency más, pero evita escribir —y mantener— un mock a mano de un SDK ajeno. Y deja el patrón montado para las 8 acciones de la segunda vuelta.

### Decisión 4: `passWithNoTests` sale con el primer test, no al final

Está en `apps/realtime-api/project.json` y es lo que permite que el target esté en verde hoy con cero cobertura.

**Elegido**: sacarlo apenas exista el primer archivo de tests.

Dejarlo para el final tiene un modo de falla concreto: mientras esté puesto, borrar todos los tests por accidente —un merge mal resuelto, un archivo que no se agrega— deja el target en verde y nadie se entera. Es exactamente la clase de configuración que da falsa sensación de cobertura, el mismo argumento que cerró la Fase 3.1.

### Decisión 5: qué cubren los unitarios y qué dejan a los e2e

Los 13 e2e ya recorren los caminos felices de punta a punta. Duplicarlos en unitarios no compra nada.

```
  e2e          el flujo completo funciona          13 casos, minutos
  unitarios    la matriz de reglas                 decenas de casos, milisegundos
```

**Elegido**: los unitarios apuntan a lo que por e2e sería inviable —empates de moda, mazos sin escala numérica, votar dos veces, votar después del revelado, el moderador no votante— y a los caminos de error, que los e2e casi no tocan.

Cada acción con lógica de decisión lleva camino feliz **y** camino de error: permiso denegado y estado inválido.

## Risks / Trade-offs

**[La extracción rompe algo]** → Es un movimiento de código sin cambios de lógica, pero toca un archivo de producción. Mitigación: los 13 e2e cubren el revelado de punta a punta y corren en el mismo pull request. Si la extracción rompiera algo, se ve ahí.

**[Los tests se escriben contra la implementación en vez de contra la regla]** → El riesgo clásico al testear código que ya existe: se copia lo que hace en vez de afirmar lo que debería hacer. Mitigación: los casos de los dos changes archivados se escriben **leyendo el change, no el código**, porque ahí está la regla enunciada.

**[Mockear resulta difícil]** → Si mockear el repositorio cuesta, esa dificultad es señal de acoplamiento mal puesto en el código, no de un problema del test. Vale la pena parar y mirar el diseño antes de forzar el mock.

## Migration Plan

1. Mover `computeRevealResult` a `lib/reveal-result.ts` y confirmar que `nx build realtime-api` y los e2e siguen verdes.
2. Tests de las dos funciones puras. Sacar `passWithNoTests` acá.
3. Agregar `aws-sdk-client-mock` y testear `reveal`.
4. Testear `vote` reusando el patrón.
5. Corregir el roadmap y anotar la segunda vuelta.

**Rollback**: revertir el commit. Los tests no tienen estado ni infraestructura asociada.

## Open Questions

Ninguna de alcance.

Queda anotado para la segunda vuelta: las 8 acciones restantes (`create-room`, `join-room`, `new-round`, `next-story`, `set-moderator-is-voter`, `close-room`, `get-room-info`, `resolve-story`). Con el patrón de mockeo ya montado, deberían ser mecánicas.
