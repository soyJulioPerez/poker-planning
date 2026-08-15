# Tareas — Configuración que no hace nada, fuera

## 1. Punto de partida

- [x] 1.1 Confirmar que `nx release` falla hoy: `npx nx release --dry-run --first-release` debe dar `Release group "__default__" matches no projects.`
- [x] 1.2 Confirmar que `@nx/docker` está instalado por `@nx/node` y no por sí mismo: `node -e "console.log(require('./node_modules/@nx/node/package.json').dependencies['@nx/docker'])"`.
- [x] 1.3 Confirmar que ningún target usa `@nx/node`: `grep -rn "@nx/node" apps/*/project.json nx.json` no debe dar resultados (fuera de comentarios de este change).

## 2. El bloque `release`

- [x] 2.1 Eliminar el bloque `"release": { ... }` de `nx.json`.
- [x] 2.2 Confirmar que `npx nx show projects` sigue listando los 6 proyectos, sin cambios.

## 3. El plugin `@nx/docker`

- [x] 3.1 Eliminar la entrada `{ "plugin": "@nx/docker", ... }` del arreglo `plugins` de `nx.json`.
- [x] 3.2 `npm uninstall @nx/docker @nx/node`.
- [x] 3.3 Confirmar que ya no está instalado: `npm ls @nx/docker` debe fallar o dar vacío (no `npm error` por lockfile roto — revisar que el uninstall haya sido limpio).

## 4. Verificación

- [x] 4.1 `npx nx build web --outputStyle=static` en verde.
- [x] 4.2 `npx nx build realtime-api --outputStyle=static` en verde.
- [x] 4.3 `npm run dev:api` arranca sin error (confirmar la línea `server.listening` en JSON y matar el proceso).
- [x] 4.4 `npx nx run-many -t lint test build --outputStyle=static` en verde para los 6 proyectos — el chequeo más amplio de que nada quedó roto.

## 5. Documentación

- [x] 5.1 `docs/hardening-roadmap.md`: cerrar 3.2 y 3.3, anotando que 3.2 se resolvió eliminando el bloque y no corrigiéndolo — el porqué queda en el `design.md` archivado.
