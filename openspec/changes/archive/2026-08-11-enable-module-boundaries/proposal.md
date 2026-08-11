# Activar los límites entre proyectos del workspace

## Why

La regla `@nx/enforce-module-boundaries` está **prendida pero no aplica a nada**, que es peor que no tenerla: da una falsa sensación de cobertura mientras `apps/web` podría importar de `apps/realtime-api` sin que ESLint dijera una palabra.

Los `depConstraints` de [eslint.config.mjs](../../../eslint.config.mjs) son boilerplate del generador de Nx —incluyen un `scope:shop` que no tiene nada que ver con un Planning Poker— y los 6 proyectos tienen `"tags": []`. Sin tags que matcheen ninguna constraint, la regla cae en su comportamiento por defecto y **rechaza toda dependencia entre proyectos**:

```
error  A project without tags matching at least one constraint cannot depend on any libraries
       @nx/enforce-module-boundaries
```

Hoy son **30 errores** de este tipo en todo el workspace, siempre sobre imports perfectamente legítimos:

| Proyecto | Errores de boundaries | Otros problemas de lint |
|---|---|---|
| `realtime-api` | 14 | 0 |
| `web` | 8 | 3 |
| `mobile` | 7 | 0 |
| `room-client-runtime` | 1 | 1 (warning) |
| `shared-contracts` | 0 | 0 |
| `e2e` | 0 | 0 |

**Por qué ahora**: esto bloquea la Fase 1.1 del [roadmap](../../../docs/hardening-roadmap.md). El workflow de CI corre `nx affected -t lint test build`; con 30 errores de boundaries, todo PR nace en rojo y el portón no sirve para nada. No es una limpieza cosmética que se pueda postergar: es prerrequisito del pipeline.

**Este change no alcanza por sí solo para desbloquear la 1.1.** Deja 5 de los 6 proyectos en verde, pero `web` sigue rojo por 2 errores de accesibilidad de `@angular-eslint` que no tienen nada que ver con boundaries (ver Impact). Hace falta un segundo change para eso. Vale decirlo acá para que nadie dé por desbloqueada la 1.1 al archivar este.

Además convierte en mecánico el desacople web/mobile/api que se logró en el change `uncouple-client-logic` y que hoy depende solo de disciplina.

## What Changes

- Se define un esquema de tags de dos ejes (`scope:*` y `type:*`) y se etiquetan los 6 proyectos del workspace.
- Se reemplazan los `depConstraints` boilerplate por constraints derivadas del grafo de dependencias real, verificado con `nx graph`.
- Se elimina `scope:shop`, que es texto de ejemplo del generador.
- Se elimina `type:data`, que tampoco corresponde a ningún proyecto de este workspace.
- Los 30 errores de boundaries desaparecen. `shared-contracts`, `room-client-runtime`, `mobile`, `realtime-api` y `e2e` quedan en **verde**; `web` queda con sus 2 errores de accesibilidad preexistentes.
- **BREAKING para el desarrollo**: a partir de este change, un import que cruce un límite no permitido falla el lint. Es el objetivo del change, pero cambia lo que antes compilaba sin queja.

## Capabilities

### New Capabilities

- `module-boundaries`: qué proyecto puede depender de cuál dentro del workspace, expresado como tags y constraints verificables por ESLint. Cubre el esquema de tags, las reglas de dependencia permitidas y la garantía de que la regla efectivamente falla cuando se la viola.

### Modified Capabilities

Ninguna. Este change no toca comportamiento del producto: no modifica lo que hace la app, solo qué imports son legales entre proyectos.

## Impact

**Configuración**
- `eslint.config.mjs` — se reescribe el bloque `depConstraints`.
- `apps/web/project.json`, `apps/mobile/project.json`, `apps/realtime-api/project.json`, `packages/shared-contracts/project.json`, `packages/room-client-runtime/project.json`, `e2e/project.json` — se llena el array `tags`.

**Sin cambios de código de aplicación.** El grafo real ya respeta las reglas que se van a imponer, así que ningún import existente debería tener que moverse. Si alguno tiene que cambiar, es un hallazgo del change y se documenta.

**Desbloquea (parcialmente) la Fase 1.1**

Saca el obstáculo mayor —30 errores repartidos en 4 proyectos— pero **no deja el lint del workspace en verde**. Queda pendiente, fuera del alcance de este change:

- `apps/web/src/app/ui/reveal-panel/reveal-panel.html:18` — 2 errores de `@angular-eslint/template`: `click-events-have-key-events` e `interactive-supports-focus`. Ya relevados en [known-issues.md](../../../docs/known-issues.md) junto con el resto de la deuda de accesibilidad.

Mientras eso siga, un PR que toque `web` deja el gate en rojo. La Fase 1.1 depende de **dos** changes, no de uno.

**Cierra** el ítem "Definir el esquema de tags y activar los boundaries" de las decisiones pendientes de [conventions.md](../../../docs/conventions.md).

**Documentación**
- [docs/known-issues.md](../../../docs/known-issues.md) — la entrada "Lint roto en todo el monorepo" queda resuelta y hay que retirarla.
- [docs/conventions.md](../../../docs/conventions.md) — la nota de que los boundaries "no aplican a nada" deja de ser cierta.
