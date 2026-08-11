# Diseño — Portón de CI con el deploy encadenado

## Context

Tres workflows, todos de deploy, ninguno verifica nada:

```
   push a master
        │
        ├──▶ deploy-backend.yml   sam build + sam deploy      (filtro de rutas a mano)
        └──▶ deploy-web.yml       nx build web + Pages
```

Agregar `ci.yml` sin más produciría esto:

```
   push a master
        │
        ├──▶ ci.yml            lint · test · build   ~2 min  ──▶ ❌ rojo
        ├──▶ deploy-backend    sam deploy            ~3 min  ──▶ ✅ prod actualizado
        └──▶ deploy-web        Pages                 ~2 min  ──▶ ✅ prod actualizado
```

Los tres arrancan a la vez. **El deploy no espera.** El check se pone rojo después de que prod ya cambió.

**Estado del workspace**, verificado antes de escribir esto:

| | |
|---|---|
| `lint` | 6 proyectos, 0 errores |
| `test` | 5 proyectos, verde |
| `build` | 5 proyectos — `mobile` es el problema (ver Decisión 1) |
| `defaultBase` | sin definir → `nx affected` falla en local |

Costo medido con cache limpia: `lint` 29s, `test` 14s, `build` 9s (4 sin mobile), `expo export` 63s.

## Goals / Non-Goals

**Goals:**

- Que ningún deploy corra sin que la verificación haya pasado.
- Que tanto la verificación como el deploy se acoten al grafo de dependencias, no a listas de rutas.
- Que `nx affected` se pueda probar en local antes de escribirlo en un YAML.
- Que ninguna tarea del pipeline consuma cuota de un servicio externo.

**Non-Goals:**

- **El e2e** es la Fase 1.2. Necesita DynamoDB Local, api y web arriba, más `npx playwright install`.
- **La branch protection** es la Fase 1.3. Este change hace que el check exista; que sea *obligatorio* se decide allá.
- **Remote cache / Nx Cloud.** Sin él CI recompila todo cada vez. Con un gate de ~2 minutos no hace falta; se evalúa si el pipeline se pone lento, no antes.
- **Los otros dos workflows no se migran a `node-version: 24`.** El nuevo nace bien; actualizar los existentes es otro change.

## Decisions

### Decisión 1: `convert-to-inferred` de mobile va dentro de este change

Hoy `nx build mobile` usa el executor `@nx/expo:build`, que **no compila nada local**: hace `fork` del CLI de `eas` y encola un build en los servidores de Expo.

Y hace algo peor, verificado reproduciéndolo:

```js
// @nx/expo/dist/src/executors/build/build.impl.js:18
resetLocalFunction = copyPackageJsonAndLock(detectPackageManager(context.root), context.root, projectRoot);
await runCliBuild(context.root, projectRoot, options);
} finally {
    resetLocalFunction();   // restaura, pero mal
```

Copia el `package.json` y el lockfile de la raíz dentro de `apps/mobile/` y los restaura al terminar — incorrectamente: deja `apps/mobile/package-lock.json` **borrado** y su `package.json` reescrito. **Ocurre incluso cuando el build falla.**

Como `packages/shared-contracts` es dependencia de mobile, cualquier PR que la toque dispararía esto. En CI el daño es efímero; en local no.

**Elegido**: renombrar los targets del plugin en `nx.json`.

```json
"buildTargetName": "eas-build",   // era "build"
"exportTargetName": "build"       // era "export"
```

**Descartado durante la implementación — `npx nx g @nx/expo:convert-to-inferred`**, que era la opción original de este diseño. No aplica:

```
$ npx nx g @nx/expo:convert-to-inferred --dry-run
NX   Could not find any targets to migrate.
```

`apps/mobile/project.json` tiene `"targets": {}`: **todos los targets ya son inferidos** por el plugin. El generador migra targets explícitos basados en executor hacia inferencia del plugin, y acá no hay nada explícito que migrar.

La deprecación no viene de una configuración vieja en `project.json` — viene de que **el plugin mismo** mapea su `buildTargetName` al executor `@nx/expo:build`. El mensaje que el executor imprime (*"Run `nx g @nx/expo:convert-to-inferred`"*) es un consejo genérico que no aplica a un workspace ya inferido.

Renombrar no "deja la deprecación viva", que era la objeción original: el executor deprecado sigue existiendo igual, solo que ahora bajo un nombre que dice lo que hace y que **ningún comando genérico invoca por accidente**. `nx affected -t build` deja de tocarlo.

**Alternativa descartada — `--exclude=mobile` en el YAML**: deja el conocimiento en el pipeline en vez de en el workspace, y la trampa armada para el próximo que corra `nx build mobile` en su máquina.

**Criterio de aceptación**: `nx build mobile` tiene que bundlear local. El equivalente es `expo export`, que produce bytecode Hermes para android e ios más el bundle web —verificación real de que la app compila en las tres plataformas— y tarda ~63s.

**Por qué va dentro de este change y no en uno propio**: es la única de las tres piezas sin la cual el gate nace roto. Separarla haría que 1.1 dependa de otro change para poder correr su propio criterio de aceptación.

### Decisión 2: el deploy es un target de Nx, no un workflow encadenado

Nx documenta el patrón:

```json
"deploy": {
  "dependsOn": ["build"],
  "command": "sam deploy --config-env $ENV"
}
```

> *"By using Nx run-commands, you can add a `deploy` target to the project. Then you can run `nx deploy`, which will run the build (if necessary) before deploying."*

Y en el workflow las etapas van en orden dentro del mismo job:

```yaml
- run: npx nx affected -t lint test build --outputStyle=static
- run: npx nx affected -t deploy --outputStyle=static   # solo master/release
```

Si el primer paso falla, el job corta y el deploy nunca corre. Sin `workflow_run`, sin `needs:` entre archivos, sin duplicar pasos.

**Esto resuelve dos problemas de una vez.** El encadenamiento es el obvio. El otro es que `deploy-backend.yml` decide hoy qué desplegar con un filtro escrito a mano:

```yaml
paths: ['apps/realtime-api/**', 'packages/shared-contracts/**', 'infra/**']
```

Eso es una aproximación manual del grafo. Si mañana `realtime-api` depende de otro paquete, el filtro no se entera y el deploy **se saltea en silencio** — el peor modo de falla posible para un deploy.

**Alternativa descartada — `workflow_run`**: el trigger toma la definición del workflow desde la rama default, no desde el commit, y la dependencia queda invisible repartida en dos archivos. Es el que más magia tiene y el más difícil de debuggear cuando no dispara.

**Alternativa descartada — job `verify` duplicado con `needs:`**: funciona, pero repite los mismos cuatro pasos en dos archivos y no aporta nada sobre encadenar dentro del job.

### Decisión 3: web también lleva target `deploy`; lo que se parte es la responsabilidad

`deploy-web.yml` publica con `actions/deploy-pages@v4`, que es una **action de GitHub**, no un comando de shell. No hay CLI equivalente, y el token OIDC que usa solo existe dentro de un workflow.

Eso tienta a dejar la web fuera del patrón. Es la conclusión equivocada, y conviene dejar escrito por qué.

**El target no existe para poder desplegar desde tu máquina.** Nadie quiere eso: en local se corren `lint`, `test` y `build`, y si hay que ver la app se levanta en `localhost`. Un target `deploy` que "corre en local" no resuelve ningún problema real — de hecho el de backend tampoco corre en local, porque `sam deploy` necesita el rol de OIDC.

**El target existe para que `nx affected -t deploy` decida qué se despliega.** Esa es la única razón, y aplica igual a las dos apps. Hoy **cualquier** push a `master` republica Pages, aunque el cambio haya sido solo del backend. Con el grafo decidiendo, no.

**Elegido**: partir la responsabilidad donde está el límite real.

```
   web:deploy  (target de Nx)     build + base-href + el cp del 404.html
                                  ↓ deja el artefacto listo
   job de Pages  (YAML)           upload-pages-artifact + deploy-pages
                                  ↓ el job corre solo si web está afectado
```

**El grafo decide _si_ se publica; la action se ocupa de _cómo_.** El job de Pages lleva un `if:` alimentado por el `affected` que calcula el job `verify` (ver Decisión 4). Si `web` no está afectada, el job no corre — ni el build, ni la subida, ni el deployment.

Efecto lateral que vale la pena: el `cp index.html 404.html` —el fallback SPA de Pages— deja de vivir suelto como un step de YAML, invisible para cualquiera que buildee `web` a mano.

**Alternativa descartada — dejar web sin target**: preserva el uso "natural" de las actions, pero deja a la web republicándose en cada push a `master` sin que nada haya cambiado en ella, que es justo lo que este change vino a corregir. Y obliga a mantener dos mecanismos de scoping distintos: grafo para backend, nada para web.

**Alternativa descartada — meter la subida dentro del target**: `upload-pages-artifact` también es una action. El target quedaría a medias igual, y encima llamándose `deploy` sin desplegar nada.

Queda una asimetría con backend, pero se explica en una línea: **el backend tiene un CLI de deploy y la web no.**

### Decisión 4: un workflow con jobs, y el `workflow_dispatch` aparte

Los dos requisitos —el deploy espera la verificación **y** corre solo si su proyecto cambió— no se sostienen con tres workflows separados: cada uno tendría que recalcular `affected` por su cuenta y volveríamos a necesitar encadenarlos entre archivos.

**Elegido**: un workflow con jobs.

```yaml
jobs:
  verify:
    outputs: { affected: ... }        # nx affected -t lint test build
  deploy-backend:
    needs: verify
    if: afectado realtime-api  &&  (master o release/**)
  deploy-web:
    needs: verify
    if: afectado web  &&  master
```

`needs:` da el orden. El `if:` da el alcance. **Nada corre de más**, y el alcance se calcula una sola vez.

**Los workflows de deploy no desaparecen: se quedan solo con el `workflow_dispatch`.**

```
   ci.yml              push / PR  →  verify  →  deploys condicionales
   deploy-backend.yml  solo workflow_dispatch  (rollback, elegir ambiente)
   deploy-web.yml      solo workflow_dispatch  (redeploy manual)
```

Esto no es solo prolijidad: **el camino manual no debe correr la verificación**. Cuando desplegás el tag `v1.4.0` a prod para hacer rollback, no querés que se verifique el código actual de la rama — querés desplegar ese tag y nada más. Meter el `workflow_dispatch` dentro del pipeline lo rompería.

**Corolario descubierto al implementar: el camino manual tampoco puede usar el target de Nx.**

La primera versión de este change hacía que `deploy-backend.yml` invocara `nx deploy realtime-api`, para que el camino manual y el automático desplegaran igual. Falla:

```
$ gh workflow run deploy-backend.yml -f environment=dev -f ref=v1.0.0
NX  Cannot find configuration for task realtime-api:deploy
```

El workflow hace checkout de un **ref arbitrario**, y ese código puede no tener el target — se agregó en `v1.1.0`. Un rollback a cualquier tag anterior lo invoca sobre un `project.json` que no lo define.

O sea: **el camino manual tiene que ser agnóstico a la versión que despliega**, y `sam build`/`sam deploy` lo son porque solo dependen de `infra/`.

Es la contracara exacta del acierto de la Decisión 2. Convertir el deploy en target de Nx es correcto para el camino automático, que siempre despliega el código actual del pipeline. Para el camino de rollback, cuyo propósito es desplegar código *viejo*, es justo lo contrario.

### Decisión 5: el YAML se genera, no se escribe

```bash
npx nx generate ci-workflow --ci=github
```

[CLAUDE.md](../../../CLAUDE.md) lo exige para scaffolding, y el generador conoce los detalles que uno olvida.

**Hay que podar lo que emite**: el ejemplo de la doc incluye `npx nx-cloud start-ci-run --distribute-on=...` y `npx nx-cloud fix-ci`. Este workspace no tiene `nxCloudId` ni token, así que esas líneas se sacan.

**Y hay que corregir una cosa**: el generador usa `node-version: 22`; acá va **24**. Los tres workflows existentes usan 20, que GitHub ya marca como deprecado, y las Lambdas corren `nodejs24.x`. Copiar el 20 sería propagar deuda conocida a un archivo nuevo.

### Decisión 6: se verifica en push, no solo en pull request

La regla de merge del repo es **squash** ([conventions.md](../../../docs/conventions.md)). Eso significa que el commit que aterriza en `develop` **no es el que se testeó**: es uno nuevo, sintetizado en el merge.

```
   PR verificado ✅        merge                 lo que queda en develop
   ──────────────────────────────────────────────────────────────────
   commits A,B,C   ──squash──▶  commit D nuevo   ← nunca corrió CI
   commits A,B,C   ──ff-only─▶  commits A,B,C    ← CI corrió sobre C
```

No es un argumento para cambiar la política de merge. Es la razón por la que el gate corre en los dos eventos.

## Risks / Trade-offs

**[`convert-to-inferred` toca más de lo esperado]** → Es un generador sobre un plugin con 11 targets configurados en `nx.json`. Mitigación: correrlo con el árbol limpio y revisar el diff completo antes de seguir. Si toca algo fuera de `mobile`, parar.

**[El target `deploy` no se puede probar sin credenciales]** → `sam deploy` necesita el rol de OIDC. En local solo se puede verificar que el target existe y que el comando se arma bien, no que despliegue. La verificación real es el primer push a una rama `release/**`, y ahí conviene mirarlo en vivo.

**[Se rompe el rollback de prod]** → `deploy-backend.yml` tiene un `workflow_dispatch` con inputs de `environment` y `ref` que permite desplegar un tag viejo sin mover `master`. Está especificado en `backend-deployment` y **hay que preservarlo intacto**. Es el riesgo más caro del change: se descubre el día que hace falta.

**[El gate se pone lento y molesta]** → Hoy ~2 minutos, más de la mitad de mobile. Si crece, la primera palanca es separar el job de mobile, no meter Nx Cloud.

## Migration Plan

1. `convert-to-inferred` de mobile y verificar que `nx build mobile` bundlea local.
2. `defaultBase` en `nx.json`; comprobar que `npx nx affected -t lint` corre sin `--base`.
3. Generar `ci.yml`, podar Nx Cloud, ajustar node a 24.
4. Targets `deploy` y reescritura de los dos workflows de deploy.
5. Verificar en un PR real: uno que toque solo `apps/web` y otro que toque `packages/shared-contracts`.

**Rollback**: revertir el commit. Los workflows viejos vuelven tal cual; no hay estado persistente.

## Open Questions

Ninguna de alcance. Las cuatro decisiones están tomadas: `convert-to-inferred` dentro del change, deploy como target de Nx en las dos apps, YAML generado, node 24.

Queda un detalle de implementación, no una decisión: **la sintaxis exacta del `if:`** que gatea los jobs de deploy según el `affected` calculado en `verify`. Se resuelve con el archivo delante.

**Lo que no es una salida aceptable**: dejar que los jobs de deploy corran siempre argumentando que republicar un artefacto idéntico es idempotente. Es cierto que es idempotente, y es irrelevante: el requisito es que **no se reejecute sin cambios**. Si el `if:` resulta difícil de expresar, se resuelve el `if:` — no se afloja el requisito.
