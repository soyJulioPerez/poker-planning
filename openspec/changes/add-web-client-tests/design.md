## Context

`apps/web` es Angular con el build system nuevo (`@angular/build`), test runner Vitest (`@angular/build:unit-test`). El único spec existente que muestra el patrón de testing del repo es `app.spec.ts` (`TestBed` + `provideRouter`).

`room.ts` y `home.ts` dependen de `RoomSocketService`, que es un wrapper delgado sobre `RoomClient` (de `room-client-runtime`). `RoomClient.hasSessionFor`/`rejoinIfNeeded` ya tienen 11 tests propios en `room-client-runtime`, tres de ellos sobre `rejoinIfNeeded` específicamente, incluido el caso exacto del bug que se está asentando acá.

## Goals / Non-Goals

**Goals:**
- Asentar con un test el comportamiento que resolvió el bug de "Link directo a una sala en pestaña nueva" para que no se pierda una segunda vez en silencio.
- Cubrir `BrowserSessionStore`, la única pieza de la cadena de sesión sin ningún test.
- Establecer un umbral de cobertura propio para `apps/web`.

**Non-Goals:**
- No se re-testea `RoomClient.hasSessionFor`/`rejoinIfNeeded` — ya cubierto en `room-client-runtime`.
- No se toca `room-client-runtime` salvo que aparezca un gap concreto al escribir los tests de arriba.
- No se prueba contra un WebSocket real ni se levanta `realtime-api` — este flujo (redirect por falta de sesión) nunca llega a llamar `connect()`/`send()`.

## Decisions

### Decisión 1: mockear `RoomSocketService`, no dejarlo real

Para los tests de `room.ts`/`home.ts` se provee un fake mínimo de `RoomSocketService` (`hasSessionFor` devolviendo `true`/`false` a voluntad; el resto de sus signals con valores neutros) en vez de usar la instancia real con `BrowserSessionStore`.

**Alternativa considerada**: dejar `RoomSocketService` real y manipular `sessionStorage` directamente en el test, para probar la cadena completa `componente → servicio → RoomClient → store`.

**Por qué se descartó**: `RoomClient.hasSessionFor` ya tiene 11 tests propios, incluido el caso exacto. Repetirlo acá es cobertura duplicada, no nueva — el mismo criterio que ya separó tests unitarios mockeados de tests de integración reales en `apps/realtime-api` (Fase 2.2/2.3): no probar dos veces la misma capa. El límite correcto es el mismo lugar donde ya hay un mock establecido en el resto del repo: el servicio que el componente inyecta.

### Decisión 2: `BrowserSessionStore` como test unitario aislado, sin `TestBed`

Se instancia la clase directamente (`new BrowserSessionStore()`) y se afirma contra `sessionStorage` real, sin pasar por Angular.

**Alternativa considerada**: mockear `sessionStorage` con un stub in-memory.

**Por qué se descartó**: `sessionStorage` está disponible tal cual en el entorno de test de `web` (jsdom/happy-dom vía Vitest) — no hay nada que mockear. La clase no tiene ninguna dependencia de Angular (no es un servicio inyectable, es una clase plana que implementa la interfaz `SessionStore` de `room-client-runtime`), así que `TestBed` sería overhead sin beneficio.

### Decisión 3: cobertura vía opciones nativas del executor, no `vitest.config.ts` aparte

Se configuran `coverage: true` y `coverageThresholds: { statements, branches, functions, lines }` directo en `apps/web/project.json`, target `test`.

**Verificado contra el schema real** (`node_modules/@angular/build/src/builders/unit-test/schema.json`): el executor `@angular/build:unit-test` expone `coverage`, `coverageThresholds`, `coverageReporters`, `coverageInclude`/`coverageExclude` como opciones de primera clase — no hace falta un archivo de configuración de Vitest aparte para esto (`runnerConfig` solo se necesita para opciones avanzadas o plugins custom, que este cambio no necesita).

**Números**: se corre `nx test web --coverage` primero para medir el estado real de la suite después de agregar los tests de arriba, y el umbral se fija en ese número (redondeando levemente hacia abajo si hace falta) — mismo criterio de trinquete que la Fase 2.3 ya estableció para `apps/realtime-api`: el valor ya alcanzado, no uno aspiracional.

### Decisión 4: sin capability nueva; `continuous-integration` gana un requirement paralelo

El comportamiento de "un link directo a una sala navega correctamente" ya está especificado en `room-management` (requirement "Creación de sala"). Este change no cambia esa especificación — solo la cubre con un test. Por eso no hay delta spec para `room-management` ni para `room-client-runtime`.

Lo único que sí es un cambio de spec es el umbral de cobertura: `continuous-integration` ya tiene el requirement "La cobertura de tests no baja del umbral ya alcanzado", pero scopeado explícitamente a `apps/realtime-api`. Se agrega un requirement hermano, scopeado a `apps/web`, en vez de generalizar el existente — son dos runners distintos (Jest vs Vitest vía `@angular/build:unit-test`) con dos targets y dos config independientes; mezclarlos en un solo requirement genérico escondería esa diferencia real.

## Risks / Trade-offs

- **[Riesgo]** El mock de `RoomSocketService` puede divergir del contrato real si `RoomSocketService` cambia su interfaz sin que el fake se actualice, dando falsos verdes. **Mitigación**: el fake implementa el mismo tipo (`RoomSocketService`), así que un cambio de interfaz rompe la compilación del test, no queda en silencio.
- **[Riesgo]** Fijar el umbral de cobertura de `web` en el valor de hoy congela ese número como piso, pero no obliga a subirlo con código nuevo sin test. **Mitigación**: mismo trade-off ya aceptado conscientemente en la Fase 2.3 — un trinquete detiene retrocesos, no exige avances; forzar avances requeriría un umbral aspiracional, que el roadmap descartó explícitamente por el riesgo de nacer en rojo.

## Migration Plan

No aplica — son tests nuevos y una opción de configuración, sin cambios de comportamiento en producción ni pasos de despliegue.
