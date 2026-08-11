# Portón de CI, con el deploy encadenado detrás

## Why

Los tres workflows de `.github/workflows/` son **todos de deploy**. Ninguno corre `lint`, `test` ni `e2e`. Un push a `master` dispara `sam deploy` y una publicación a GitHub Pages sin que se haya ejecutado una sola prueba.

Y el repo nunca usa `nx affected`, que es la razón técnica principal para tener un monorepo: sin él, o se corre todo siempre, o no se corre nada — que es lo que pasa hoy.

**Por qué ahora**: los dos prerrequisitos de lint ya se resolvieron. `nx run-many -t lint --all` pasa en los 6 proyectos (Fase 3.1 más el change de accesibilidad), y `test` pasa en los 5 que tienen tests. El gate puede nacer en verde en vez de nacer en rojo.

**Y una segunda razón, que apareció al explorar**: agregar `ci.yml` sin más lo dejaría corriendo **en paralelo** con los deploys, no antes. En un push a `master` los tres workflows arrancarían a la vez y el deploy terminaría sin saber si los tests pasaron. El check se pondría rojo después de que prod ya se actualizó. Un portón que no está en la puerta no es un portón.

## What Changes

**El portón**
- Se crea `.github/workflows/ci.yml` con un job único que corre `nx affected -t lint test build` en pull requests y en push a `develop`, `release/**` y `master`.

**El deploy pasa a ser un target de Nx**
- `realtime-api` y `web` reciben un target `deploy` con `dependsOn: ["build"]`. El workflow encadena las etapas en orden: primero `nx affected -t lint test build`, después `nx affected -t deploy`. Si lo primero falla, el job corta y el deploy nunca corre.
- **BREAKING (para el pipeline, no para el producto)**: desaparece el filtro de rutas escrito a mano de `deploy-backend.yml`. Qué se despliega lo decide el grafo de dependencias de Nx, no una lista de globs que hay que mantener a mano.

**Mobile deja de disparar builds en la nube**
- `npx nx g @nx/expo:convert-to-inferred`. Hoy `nx build mobile` invoca `eas build` —consume cuota de Expo, necesita `EXPO_TOKEN`— y **corrompe el working tree aunque falle**: borra `apps/mobile/package-lock.json` y reescribe su `package.json`. Es prerrequisito: `packages/shared-contracts` es dependencia de mobile, así que cualquier PR que la toque lo dispararía.

**Higiene que va de paso**
- `"defaultBase": "develop"` en `nx.json`. Hoy no está, Nx cae a `main` —que no existe en este repo— y `nx affected` sin `--base` **falla en local**.
- `node-version: 24` en el workflow nuevo. Los tres existentes usan 20, que GitHub ya marca como deprecado; las Lambdas corren `nodejs24.x`.

## Capabilities

### New Capabilities

- `continuous-integration`: el portón de verificación — qué tareas corren, sobre qué commits, acotadas por el grafo de dependencias, y la garantía de que un fallo deja el check en rojo antes de que nada se despliegue.

### Modified Capabilities

- `backend-deployment`: el requirement *"Automated build and deploy to AWS on relevant changes"* enumera hoy los filtros de ruta (`apps/realtime-api/**`, `packages/shared-contracts/**`, `infra/**`). Pasa a decidirse por el grafo de Nx, y el deploy queda condicionado a que la verificación pase.
- `web-static-deployment`: el requirement *"Automated build and publish to GitHub Pages"* pasa a estar condicionado a la misma verificación previa.

## Impact

**Workflows**
- `.github/workflows/ci.yml` — nuevo, generado con `nx generate ci-workflow --ci=github`.
- `.github/workflows/deploy-backend.yml` — pierde el filtro de rutas, gana la etapa de verificación previa. **Conserva** el `workflow_dispatch` con inputs de `environment` y `ref`: es el mecanismo de rollback de prod, especificado en `backend-deployment`.
- `.github/workflows/deploy-web.yml` — gana la verificación previa.

**Configuración**
- `nx.json` — `defaultBase`.
- `apps/realtime-api/project.json`, `apps/web/project.json` — target `deploy`.
- `apps/mobile/project.json` y `nx.json` — lo que toque `convert-to-inferred`.

**Sin cambios de código de aplicación.** Nada de `src/`.

**Costo medido** (cache limpia, corridas verificadas con exit 0): `lint` 29s · `test` 14s · `build` 9s (4 proyectos, sin mobile) · `expo export` 63s. El gate completo está en el orden de **~2 minutos**, así que el job único alcanza.

**Fuera de alcance**
- El e2e en CI es la Fase 1.2. Necesita DynamoDB Local, api y web arriba, más un `npx playwright install` explícito.
- La branch protection es la Fase 1.3. Este change hace que el check exista; que sea obligatorio se decide allá.
