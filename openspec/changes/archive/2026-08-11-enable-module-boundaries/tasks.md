# Tareas — Activar los límites entre proyectos

> **Criterio de "verde" para todo este change**: cero errores de `@nx/enforce-module-boundaries`.
> **`nx lint web` va a seguir fallando** por 2 errores de accesibilidad preexistentes
> (`reveal-panel.html:18`), fuera de alcance — ver `design.md`, Open Questions.
> Filtrar por la regla al verificar; el exit code pelado no sirve como criterio.
>
> Punto de partida medido: 30 errores de boundaries
> (`realtime-api` 14, `web` 8, `mobile` 7, `room-client-runtime` 1).

## 1. Punto de partida

- [x] 1.1 Registrar el estado inicial: correr `npx nx run-many -t lint --all --skip-nx-cache` y anotar cuántos errores de `@nx/enforce-module-boundaries` hay por proyecto. Sin esta foto no se puede demostrar la mejora.
- [x] 1.2 Confirmar el grafo real con `npx nx graph --file=<tmp>/graph.json` y verificar que las dependencias entre proyectos son las que asume `design.md` (`shared-contracts` sin dependencias; `room-client-runtime` y `realtime-api` → `shared-contracts`; `web` y `mobile` → `room-client-runtime` + `shared-contracts`; `e2e` sin dependencias). Si difiere, **parar** y revisar el diseño antes de seguir.

## 2. Etiquetar los proyectos

- [x] 2.1 `packages/shared-contracts/project.json` → `"tags": ["scope:shared", "type:util"]`
- [x] 2.2 `packages/room-client-runtime/project.json` → `"tags": ["scope:client", "type:feature"]`
- [x] 2.3 `apps/web/project.json` → `"tags": ["scope:web", "type:app"]`
- [x] 2.4 `apps/mobile/project.json` → `"tags": ["scope:mobile", "type:app"]`
- [x] 2.5 `apps/realtime-api/project.json` → `"tags": ["scope:api", "type:app"]`
- [x] 2.6 `e2e/project.json` → `"tags": ["scope:e2e", "type:e2e"]`
- [x] 2.7 Confirmar que los 6 quedaron aplicados: `npx nx show projects --json` y revisar que ningún proyecto tenga `tags` vacío.

## 3. Reescribir las constraints

- [x] 3.1 En `eslint.config.mjs`, reemplazar el bloque `depConstraints` por las 10 constraints de `design.md` (6 de `scope:*` + 4 de `type:*`).
- [x] 3.2 Confirmar que `scope:shop` y `type:data` ya no aparecen en ningún lado del archivo.
- [x] 3.3 Dejar intactos `enforceBuildableLibDependency: true` y el `allow` de los `eslint.config` — no son parte de este change.

## 4. Verificar que el lint quedó limpio

- [x] 4.1 `npx nx run-many -t lint --all --skip-nx-cache` y confirmar **cero** errores de `@nx/enforce-module-boundaries` en los 6 proyectos.
- [x] 4.2 Comparar contra la foto de 1.1: los errores de boundaries bajaron a cero y **no apareció ningún error nuevo** de otra regla.
- [x] 4.3 Si algún import legítimo resultó ilegal: **no relajar la constraint**. Anotar el caso, entender por qué, y decidir a propósito si la regla está mal o el import lo está (ver `design.md`, Risks).

## 5. Verificación activa: romper a propósito

> Sin esto, no sabemos si la regla protege algo. Es el punto del change.

- [x] 5.1 Agregar temporalmente en un archivo de `apps/web` un import de `apps/realtime-api`.
- [x] 5.2 Confirmar que `npx nx lint web --skip-nx-cache` **falla** con `@nx/enforce-module-boundaries`, y capturar el mensaje.
- [x] 5.3 Revertir el import y confirmar que `nx lint web` vuelve a no reportar errores de boundaries.
- [x] 5.4 Repetir el ejercicio en el otro sentido: un import de `apps/web` dentro de `packages/shared-contracts` debe fallar `nx lint shared-contracts`. Revertir. Esto verifica el eje `type:*`, que 5.1 no ejercita.
- [x] 5.5 Confirmar con `git status` que no quedó ningún resto de las violaciones deliberadas.

### Resultado de la verificación

Se hicieron **tres** violaciones deliberadas, no dos, porque las dos primeras no probaban lo que se creía. Las tres fueron rechazadas por `@nx/enforce-module-boundaries`, pero por sub-reglas distintas:

| Violación | Sub-regla que disparó | ¿Prueba las constraints de tags? |
|---|---|---|
| `web` → `realtime-api` (relativo) | `Projects cannot be imported by a relative or absolute path` | **No** |
| `realtime-api` → `room-client-runtime` (alias) | `A project tagged with "scope:api" can only depend on libs tagged with "scope:api", "scope:shared"` | **Sí** ✅ |
| `shared-contracts` → `room-client-runtime` (alias) | `Circular dependency between "shared-contracts" and "room-client-runtime"` | **No** |

**Lo que quedó probado**: las constraints de `scope:*` funcionan y el mensaje nombra los tags. Es exactamente la Decisión 2 del `design.md` — la Lambda no puede importar el runtime de cliente.

**Lo que NO se pudo probar en aislamiento**: el eje `type:*`. Ver la nota agregada a `design.md`.

## 6. Documentación

- [x] 6.1 `docs/known-issues.md` — eliminar la entrada "Lint roto en todo el monorepo: `@nx/enforce-module-boundaries`". Queda resuelta.
- [x] 6.2 `docs/conventions.md` — reescribir el bullet de "Límites entre proyectos", que hoy dice que la regla "no aplica a nada". Reemplazar por el esquema de tags vigente y qué puede depender de qué.
- [x] 6.3 `docs/conventions.md` — agregar que todo `nx g` de un proyecto nuevo debe pasar `--tags`. Los generadores de Nx aceptan el flag pero **no infieren tags**: omitirlo es lo que produjo este problema (ver `INSTALL_LOG.md`).
- [x] 6.4 `docs/conventions.md` — marcar como hecho el ítem "Definir el esquema de tags y activar los boundaries" en Decisiones pendientes.
- [x] 6.5 `docs/hardening-roadmap.md` — marcar la Fase 3.1 y actualizar la tabla de Estado.
- [x] 6.6 `docs/hardening-roadmap.md` — en las Trampas de la Fase 1.1, **actualizar** (no eliminar) la advertencia de que `nx lint` está rojo: los 30 errores de boundaries desaparecen, pero quedan los 2 de accesibilidad en `web`. La Fase 1.1 sigue bloqueada hasta que se resuelvan.
- [x] 6.7 Dejar anotado en `docs/known-issues.md`, junto a la deuda de ARIA ya relevada, que esos 2 errores de `reveal-panel.html:18` son ahora **lo único** que impide meter `lint` en el gate de CI. Cambia su prioridad: pasan de mejora de accesibilidad a bloqueante de pipeline.

## 7. Cierre

- [x] 7.1 Correr `npx nx run-many -t lint test build --all --exclude=mobile --skip-nx-cache` como verificación final de que nada colateral se rompió. (`mobile` se excluye del `build` porque hoy dispara `eas build`; ver la Fase 1.1 del roadmap.)
- [x] 7.2 Confirmar que el diff no toca ningún archivo de código de aplicación — solo `project.json`, `eslint.config.mjs` y `docs/`. Si toca código, debería estar justificado por 4.3.
- [x] 7.3 `/opsx:verify` y después `/opsx:archive`.
