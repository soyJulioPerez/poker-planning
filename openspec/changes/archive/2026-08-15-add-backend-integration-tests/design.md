## Context

Los 93 tests de `realtime-api` mockean DynamoDB con `aws-sdk-client-mock` en todo el suite — rápido y sin Docker, pero ninguno valida que las expresiones (`KeyConditionExpression`, `begins_with`) sean correctas contra el motor real. La infra de DynamoDB Local ya existe desde la Fase 1.2 (`npm run e2e:db:up`, `tools/scripts/wait-for-dynamodb.mjs`), armada para los e2e de Playwright — se reusa acá, no se duplica.

Cobertura real medida el 2026-08-15 (`nx test realtime-api --coverage`): Statements 86.38% (406/470), Branches 76.2% (237/311), Functions 95.52% (64/67), Lines 86.12% (391/454).

## Goals / Non-Goals

**Goals:**
- Las queries reales de `room-repository.ts` (single-table: PK/SK, `begins_with`, TTL) verificadas contra DynamoDB Local, no solo contra un mock.
- `nx test realtime-api` sigue siendo el mismo comando rápido de siempre — cero fricción para quien no toca `room-repository.ts`.
- Un umbral de cobertura que falle CI si baja, fijado en lo ya alcanzado.

**Non-Goals:**
- No se migran los 93 tests existentes a integración — siguen mockeados, es lo correcto para lo que prueban (lógica de acciones, no queries).
- No se cubre `web`/`room-client-runtime` (Fase 2.4, aparte).
- No se mide cobertura de los tests de integración ni se mezcla con el umbral del target rápido.

## Decisions

### 1. `test-integration` vía `nx:run-commands`, no inferencia ni el executor de Jest

El plan original —segunda entrada de `@nx/jest/plugin` en `nx.json`, distinguida por `include`/`exclude`— resultó no ser viable, y se descubrió recién al implementar, no antes. Dos callejones sin salida, en orden:

1. **El glob de descubrimiento del plugin está fijo.** `@nx/jest/plugin` busca únicamente archivos llamados literalmente `jest.config.{cjs,mjs,js,cts,mts,ts}` (`node_modules/@nx/jest/dist/src/plugins/plugin.js`) — un `jest.integration.config.cts` nunca se descubre, sin importar el `include`/`exclude`, porque ese filtro actúa sobre archivos ya encontrados, no cambia qué cuenta como config de Jest.
2. **Moverlo a una subcarpeta con el nombre correcto tampoco alcanza.** El plugin exige que la carpeta donde vive el config tenga **su propio** `package.json` o `project.json` (`checkIfConfigFileShouldBeProject`) — o sea, tiene que ser la raíz de un proyecto Nx distinto, no una subcarpeta de `realtime-api`. Y convertirlo en un proyecto hermano (el patrón que sí usa `e2e/project.json` para separar Playwright de los unitarios) choca con una regla de este mismo repo: `realtime-api` es `type:app`, y `enforce-module-boundaries` prohíbe explícitamente depender de una app ("las apps son hojas"). Un proyecto separado que importe `room-repository.ts` rompería esa regla a propósito.

La solución real: `test-integration` se declara a mano en `project.json` con el executor genérico `nx:run-commands` —el mismo que ya usan `lint` y `deploy` en este archivo—, invocando `jest --config jest.integration.config.cts` directo, sin pasar por el plugin de Jest ni por su executor dedicado (`@nx/jest:jest`, que además está deprecado, eliminado en Nx v24). Se queda en el mismo proyecto (`realtime-api`), no cruza ningún límite de módulos, y no depende de ningún mecanismo de descubrimiento con reglas implícitas. Verificado: `npx nx show project realtime-api --json` muestra los dos targets, `nx test realtime-api` sigue corriendo exactamente los mismos 93 tests de siempre, y `nx run realtime-api:test-integration` invoca el config correcto (confirmado con `testMatch: **/*.integration.spec.ts — 0 matches` antes de que existiera el spec).

Efecto secundario aceptado: al no pasar por el plugin de Jest, `test-integration` no tiene el caching/inputs/outputs automático que sí tiene `test`. Es razonable para este caso — un test de integración habla con estado externo (DynamoDB Local), y servir un resultado cacheado de una corrida anterior sería, en el mejor de los casos, poco útil.

### 2. Job de CI nuevo, en paralelo — no dentro de `verify` ni de `e2e`

Mismo criterio que ya separó `e2e` de `verify` en la Fase 1.2: no demorar el feedback rápido con algo que necesita Docker. Meterlo dentro de `verify` obligaría a levantar DynamoDB Local en el job que hoy es el más rápido del pipeline. Meterlo dentro de `e2e` mezclaría dos preocupaciones distintas (tests de integración del backend vs. tests end-to-end del producto completo) bajo un mismo job, complicando su lectura cuando algo falla. Un job nuevo, en paralelo, reusa el script (`npm run e2e:db:up`) sin reusar el job.

### 3. Cobertura: solo el target rápido, umbral en números enteros

El umbral vive en `coverageThreshold` de `jest.config.cts` (el config del target `test`, no el de `test-integration`) — mismo criterio que el roadmap ya aplicó para no mezclar Jest de `realtime-api` con Vitest de `web`: cada medición de cobertura separada, sin un número único que las combine.

Los valores reales medidos (86.38 / 76.2 / 95.52 / 86.12) se redondean hacia abajo a enteros (86 / 76 / 95 / 86) — sigue siendo "el valor ya alcanzado", no uno aspiracional, pero sin la falsa precisión de dos decimales que cualquier test nuevo agregado en el futuro va a mover de todas formas.

### 4. `roomId` único por test, limpieza en `afterEach`

Cada test de integración genera su propio `roomId` (`crypto.randomUUID()` o similar) y borra sus propios items en `afterEach` — sin fixtures compartidas ni estado que dependa del orden de ejecución. Corren contra la misma tabla que usa `npm run dev:api` en local, pero con datos que no colisionan con lo que alguien pueda tener abierto a mano.

## Risks / Trade-offs

- **[Riesgo] El job nuevo de CI agrega tiempo de pared** (levantar Docker, esperar DynamoDB Local) → mitigado porque corre en paralelo a `verify`/`e2e`, no en serie; el costo es Actions-minutes, no feedback más lento.
- **[Riesgo] Umbral de cobertura roto por un refactor legítimo que no agrega tests** → aceptado a propósito, es el comportamiento querido de un trinquete: si baja, hay que decidir conscientemente subir cobertura o ajustar el número, no que pase desapercibido.

## Migration Plan

1. `jest.integration.config.cts` + segunda entrada de `@nx/jest/plugin` en `nx.json`.
2. `room-repository.integration.spec.ts` contra DynamoDB Local (requiere `npm run dev:db:up` + `npm run dev:db:create-table` corriendo en local para probarlo).
3. `coverageThreshold` en `jest.config.cts`, con los números fijados arriba.
4. Job nuevo en `ci.yml`.
5. Verificar en CI real (push a una rama, no solo local) que el job nuevo corre y encuentra DynamoDB Local.

Sin plan de rollback especial: target y job nuevos, no tocan nada existente — revertir el commit basta.

## Open Questions

Ninguna abierta.
