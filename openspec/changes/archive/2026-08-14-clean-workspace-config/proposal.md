# Configuración que no hace nada, fuera

## Why

`nx.json` tiene dos configuraciones que dan sensación de cobertura sin darla:

**El bloque `release` no configura, rompe.**
```
NX  Release group "__default__" matches no projects.
```
Apunta a un proyecto llamado `"api"`, que no existe — el proyecto se llama `realtime-api`. `nx release` falla hoy, con ese mensaje, para quien lo pruebe.

**El plugin `@nx/docker` no hace nada, y su dependencia queda instalada igual.**
Está registrado en `nx.json` con `buildTarget`/`runTarget`, y no hay un solo `Dockerfile` en el repo — infiere cero targets en los 6 proyectos, en cada corrida de Nx. Y sacarlo de `package.json` no alcanza: `@nx/docker` es dependencia **dura** de `@nx/node` (no peer), así que sigue instalándose mientras `@nx/node` quede declarado. `@nx/node` tampoco lo usa nadie — `realtime-api` arranca con el executor `@nx/js:node`, de un paquete distinto.

Es la misma clase de hallazgo que cerró la Fase 3.1: configuración sin efecto es peor que no tenerla, porque nadie se entera hasta que la necesita y falla.

## What Changes

**Se elimina el bloque `release` de `nx.json` entero, no se corrige.**
- Corregir `"api"` → `"realtime-api"` lo dejaría *funcionando* pero encodearía `"projectsRelationship": "independent"` — versión y tag por proyecto. Este repo taggea el repo entero (`v1.4.1`, ayer), no por proyecto. Arreglarlo sería peor que el error actual: hoy falla ruidosamente; corregido a medias fallaría en silencio, versionando mal el día que alguien lo use.
- El diseño real de versionado es la Fase 7.1, con el modelo del repo completo delante.

**Se elimina el plugin `@nx/docker`, en las tres capas donde vive.**
- La entrada del plugin en `nx.json`.
- `@nx/docker` de `package.json` (`devDependencies`).
- `@nx/node` de `package.json` — es quien arrastra a `@nx/docker` como dependencia dura, y no lo usa ningún target del workspace.

## Capabilities

Ninguna. Este change no toca comportamiento del producto ni del pipeline — es higiene de configuración que hoy no hace nada.

## Impact

**Configuración**
- `nx.json` — sale el bloque `release` y la entrada del plugin `@nx/docker`.
- `package.json` — salen `@nx/docker` y `@nx/node` de `devDependencies`.

**Sin cambios de código de aplicación ni de CI.**

**Verificación**: `npx nx show projects`, `npx nx build web`, `npx nx build realtime-api` y `npm run dev:api` siguen funcionando igual — ninguno depende de lo que se saca.

**Fuera de alcance**
- **Diseñar el versionado real** (Fase 7.1). Este change limpia el terreno; no decide `independent` vs. repo completo.
- **Cualquier app Node nueva.** Si aparece, el patrón a copiar es el de `realtime-api` (`@nx/esbuild` + `@nx/js:node`), no `@nx/node`. Reinstalarlo, si hiciera falta, es un `npm i -D` reversible.
