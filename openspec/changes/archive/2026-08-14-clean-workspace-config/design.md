# Diseño — Configuración que no hace nada, fuera

## Context

Dos hallazgos de la Fase 3, verificados antes de escribir esto:

```
$ npx nx release --dry-run --first-release
NX  Release group "__default__" matches no projects.

$ npx nx show projects
["room-client-runtime","shared-contracts","realtime-api","mobile","web","e2e"]
```

`nx.json` declara `"release": { "projects": ["api"] }`. No existe `api`; existe `realtime-api`.

```
$ node -e "console.log(require('./node_modules/@nx/node/package.json').dependencies['@nx/docker'])"
23.0.1
```

`@nx/docker` está en `dependencies` de `@nx/node` — no en `peerDependencies`. Sacarlo del `package.json` de este repo no lo saca de `node_modules` mientras `@nx/node` siga declarado.

```
$ node -e "console.log(require('./apps/realtime-api/project.json').targets.serve.executor)"
@nx/js:node
```

El `serve` que usa `npm run dev:api` corre con el executor `node` de `@nx/js`, un paquete distinto de `@nx/node`. Cero referencias a `@nx/node` en código fuente, `project.json` o `nx.json`.

## Goals / Non-Goals

**Goals:**

- Que `nx.json` no declare nada que esté roto o que no haga nada.
- Que `@nx/docker` deje de instalarse de verdad, no solo de mencionarse.
- Dejar escrito por qué no se "arregla" el bloque `release`, para que nadie lo reintroduzca corrigiendo solo el nombre.

**Non-Goals:**

- **Diseñar el versionado real** — Fase 7.1.
- **Cualquier generador o executor de Node nuevo.**

## Decisions

### Decisión 1: el bloque `release` se elimina, no se corrige

La corrección mínima —`"api"` → `"realtime-api"`— haría que `nx release` corriera. Pero dejaría en pie `"projectsRelationship": "independent"`, que versiona **por proyecto**: cada release de `realtime-api` tendría su propio número y su propio tag, independiente de `web` o de `mobile`.

Eso contradice cómo se releasea este repo hoy:

```
git tag v1.4.1     ← un tag, para el repo entero
                     web, realtime-api y mobile se mueven juntos
```

Corregir el nombre sin revisar `projectsRelationship` cambiaría el síntoma de "falla con un error claro" a "corre y versiona mal", que es peor: el primero se nota en el primer intento, el segundo se nota cuando ya hay tags de proyecto sueltos que no encajan con la convención real.

**Elegido**: eliminar el bloque entero. El diseño del versionado —`independent` vs. repo completo, qué dispara un release, dónde vive el changelog— es exactamente el alcance de la Fase 7.1, y merece decidirse con el modelo completo delante, no heredado de una config rota.

### Decisión 2: `@nx/docker` sale en sus tres capas, no solo de `nx.json`

Sacar solo la entrada del plugin en `nx.json` detiene la inferencia de targets, pero dejaría el paquete instalado igual —vía `@nx/node`— y el `package.json` seguiría listando `@nx/docker` como si el repo lo usara.

**Elegido**: las tres capas juntas.

```
nx.json           quita la entrada del plugin        detiene la inferencia
package.json       quita @nx/docker                   deja de declararse directo
package.json       quita @nx/node                      deja de arrastrar @nx/docker como dependencia dura
```

Sin la tercera, `npm ls @nx/docker` seguiría mostrándolo instalado después de este change, y el objetivo del proposal —que deje de ser superficie de instalación— no se cumpliría.

**Sobre `@nx/node` en particular**: no es una víctima colateral, es lo que realmente resuelve el problema. Verificado que no lo usa ningún target: `realtime-api:serve` corre con `@nx/js:node`, un executor de un paquete distinto. Si en el futuro se agrega una app Node, el patrón a replicar es el que ya usa `realtime-api` (`@nx/esbuild` + `@nx/js:node`), no los generadores de `@nx/node`. Reinstalarlo es un `npm i -D @nx/node` reversible el día que haga falta de verdad — más barato que cargarlo hoy por si acaso.

## Risks / Trade-offs

**[`npm install` después de sacar las devDependencies deja algo roto]** → Ninguno de los tres cambios toca un executor que algo use. Mitigación: verificar `nx show projects`, `build` de `web` y `realtime-api`, y `npm run dev:api` después del `npm install`.

**[Alguien reintroduce el plugin de Docker sin saber por qué se sacó]** → Este `design.md` queda en el archive como registro. Si en el futuro aparece un Dockerfile real, se reinstala `@nx/docker` (y `@nx/node` si el patrón de esa app lo necesita) con el contexto de ese momento.

## Migration Plan

1. Eliminar el bloque `release` de `nx.json`.
2. Eliminar la entrada del plugin `@nx/docker` de `nx.json`.
3. `npm uninstall @nx/docker @nx/node` (actualiza `package.json` y el lockfile en un paso).
4. Verificar: `nx show projects`, `nx build web`, `nx build realtime-api`, `npm run dev:api`.
5. Confirmar que `@nx/docker` ya no aparece instalado.

**Rollback**: revertir el commit y `npm install`. Sin estado que migrar.

## Open Questions

Ninguna de alcance.
