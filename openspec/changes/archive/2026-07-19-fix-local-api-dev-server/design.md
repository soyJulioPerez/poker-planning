## Context

`apps/realtime-api` tiene hoy tres caminos de ejecución independientes, sin superposición entre sí:

1. **Despliegue a AWS** (`sam build && sam deploy`): compila directamente `apps/realtime-api/src/handlers/{connect,disconnect,default}.ts` con esbuild propio de SAM (ver `infra/template.yaml`). No depende de Nx ni de `main.ts` en absoluto.
2. **`nx serve realtime-api`**: usa el executor nativo de Nx (`@nx/esbuild:esbuild` para el build + `@nx/js:node` para ejecutar), con `apps/realtime-api/src/main.ts` como entry point. Hoy `main.ts` es el placeholder sin tocar del scaffold de Nx (`console.log('Hello World')`) — este target no arranca nada útil.
3. **`npm run dev:api`**: corre `tsx watch apps/realtime-api/src/dev-server.ts` directamente, fuera de Nx. `dev-server.ts` es un servidor WebSocket completo (librería `ws`) que enruta mensajes a los mismos `handle*` que usan las Lambdas reales, pensado para emular la API Gateway WebSocket localmente contra DynamoDB Local. Este es el único camino realmente usado para desarrollo local, y falla con `Cannot find module 'shared-contracts'` porque `tsx` no resuelve el path mapping de `tsconfig.base.json` de la misma forma que lo hace `@nx/esbuild` (que compila el import a una ruta relativa real antes de ejecutar; `tsx` en cambio ejecuta el `.ts` sin ese paso de compilación previo, y su resolución de módulos cae en el loader CJS nativo de Node, que no tiene ningún path mapping aplicado).

## Goals / Non-Goals

**Goals:**
- `npm run dev:api` vuelve a funcionar, arrancando el servidor WebSocket de desarrollo (mismo comportamiento observable: puerto `3001`, conexión a DynamoDB Local, mismas acciones soportadas).
- El arranque pasa a usar el mecanismo nativo de Nx (`@nx/esbuild` + `@nx/js:node`), consistente con cómo se ejecutan/buildean el resto de los proyectos del monorepo, en vez de una herramienta externa (`tsx`) que resuelve módulos de forma distinta.
- Se mantiene watch mode (recarga automática al guardar cambios) — `@nx/js:node` lo soporta de forma nativa (`--watch`, default `true`), rebuildeando y reiniciando el proceso.

**Non-Goals:**
- No se toca el flujo de despliegue a AWS (`sam build`/`sam deploy`, `infra/template.yaml`) — confirmado que no depende de `main.ts` ni de ningún target de Nx.
- No se resuelve la falta de infraestructura de tests de `realtime-api` (deuda separada, ya anotada en `docs/future-ideas.md`).
- No se cambia el protocolo ni las acciones soportadas por el servidor WebSocket local — es un cambio de cómo se arranca el proceso, no de qué hace una vez arrancado.

## Decisions

### Decisión 1: `main.ts` pasa a ser el entry point de `dev-server.ts`
Se reemplaza el contenido de `main.ts` para que arranque el servidor WebSocket (ya sea moviendo el contenido de `dev-server.ts` a `main.ts`, o dejando `dev-server.ts` como está e importándolo desde `main.ts`). El target `serve` de `project.json` ya usa el executor correcto (`@nx/esbuild` + `@nx/js:node`) — no requiere cambios estructurales, solo que el archivo que compila y ejecuta deje de ser un placeholder.

**Alternativa considerada**: mantener `dev-server.ts` como archivo separado y agregar un target Nx nuevo (ej. `serve-local`) que apunte a él en vez de a `main.ts`. Se descartó porque `main.ts` ya es el entry point convencional de un proyecto Nx tipo aplicación Node, y hoy no cumple ninguna función real — reutilizarlo es más simple que introducir un segundo target paralelo con el mismo propósito.

### Decisión 2: `npm run dev:api` pasa a invocar `nx serve realtime-api`, preservando `cross-env` para las variables de entorno
El script en `package.json` cambia de `cross-env ... tsx watch apps/realtime-api/src/dev-server.ts` a `cross-env ... nx serve realtime-api`, manteniendo las mismas variables de entorno (`DYNAMODB_ENDPOINT`, `AWS_REGION`, `TABLE_NAME`) que ya se pasaban. Nx no tiene una convención propia de `.env` configurada en este repo (`nx.json` no declara `loadEnvFiles` ni similar), así que seguir inyectando las variables desde el script npm que envuelve al comando `nx` es el camino más simple, sin introducir un mecanismo nuevo.

**Alternativa considerada**: mover las variables de entorno a un archivo `.env` leído automáticamente por Nx. Se descartó por alcance — introduciría una convención nueva al repo sin necesidad clara, cuando `cross-env` ya resuelve el caso de forma directa.

### Decisión 3: Se elimina la dependencia de `tsx` para este flujo
Una vez que `npm run dev:api` no lo usa, `tsx` queda sin ningún consumidor conocido en el repo. Se retira de `package.json` (`devDependencies`) si al revisar no queda ninguna otra referencia.

## Risks / Trade-offs

- [Riesgo] `@nx/esbuild` podría no bundlear `dev-server.ts` exactamente igual que `tsx` (ej. algún import específico de Node no soportado) → Mitigación: `@nx/esbuild` ya compila con éxito el resto de `apps/realtime-api` (usado en `nx build realtime-api`, que sí funciona hoy), incluyendo los mismos `handle*` que importa `dev-server.ts`; el riesgo real es bajo. Se verifica manualmente como parte de las tareas de este change.
- [Riesgo] El primer arranque de `nx serve realtime-api` es más lento que `tsx watch` (por el paso de build previo) → Aceptado; el watch mode incremental de Nx compensa esto en iteraciones posteriores, y la prioridad es correctitud/consistencia con Nx, no velocidad de arranque en frío.
- [Trade-off] Se pierde la posibilidad de correr `dev-server.ts` sin pasar por Nx en absoluto (por ejemplo si Nx tuviera algún problema puntual) → Aceptado como consecuencia directa de la decisión explícita de seguir el camino nativo de Nx en vez de mantener una vía alternativa con `tsx`.

## Migration Plan

Cambio de desarrollo local puro, sin datos de producción ni usuarios afectados. Pasos:
1. Actualizar `main.ts` para arrancar el servidor.
2. Actualizar el script `dev:api` en `package.json`.
3. Actualizar `docs/local-dev-workflow.md`.
4. Verificar manualmente el flujo completo (levantar DynamoDB Local, `npm run dev:api`, probar crear/unirse a una sala desde el frontend).
5. Retirar `tsx` de dependencias si queda sin uso.

Sin plan de rollback especial — si algo falla, revertir el commit restaura `tsx watch` como estaba.

## Open Questions

Ninguna bloqueante. A confirmar durante la implementación: si mover el contenido de `dev-server.ts` a `main.ts` directamente, o dejar `dev-server.ts` como módulo separado importado desde `main.ts` (preferencia de organización de código, sin impacto funcional).
