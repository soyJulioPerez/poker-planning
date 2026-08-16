## 1. Estado de partida

- [x] 1.1 Correr `npm audit --json` en la raíz y confirmar el conteo por severidad antes de tocar nada (referencia: 2026-08-15, 0 critical / 48 high / 13 moderate / 2 low — ver `design.md`).
- [x] 1.2 Confirmar que `npm audit --audit-level=critical` termina en exit 0 con el estado actual del árbol.

## 2. Workflow

- [x] 2.1 Agregar el job `dependency-audit` a `.github/workflows/ci.yml`, en paralelo a `verify`/`test-integration`/`e2e` (mismo nivel, no anidado dentro de ninguno).
- [x] 2.2 El job SHALL correr `npm audit --audit-level=critical` (`checkout`, `setup-node@v5` con `node-version: 24` y `cache: npm`, `npm ci`, y el `npm audit`) — sin `nx affected`, sin `fetch-depth: 0`, sin `nx-set-shas`: audita el árbol completo, no un subconjunto por proyecto (ver `design.md`, Decisión 3).
- [x] 2.3 **No usar `|| true` ni ningún mecanismo que silencie el exit code.** El umbral (`critical`) es la única palanca de ruido permitida.
- [x] 2.4 Sumar `dependency-audit` a `needs:` de `deploy-backend` y `deploy-web`.
- [x] 2.5 Comentarios en el YAML explicando: por qué no usa `nx affected`, por qué el umbral es `critical` y no `high` (con referencia a `design.md`), y que `npm audit` imprime todo lo que encuentra sin importar `--audit-level`.

## 3. Criterio de aceptación (roadmap Fase 5.2)

- [x] 3.1 Un job corre `npm audit` con un umbral de severidad acotado (`--audit-level=critical`, en vez del `--audit-level=high` que sugería el roadmap — `--production`/`--omit=dev` se probó y no alcanzaba a bajar el ruido en este `package.json`; ver `design.md` Decisión 1).
- [x] 3.2 Está documentado, explícitamente, qué severidad rompe el build (`critical`) y cuál solo avisa (`high`, `moderate`, `low` — visibles en el log, sin fallar el job). Documentado en `design.md` y en `openspec/specs/continuous-integration/spec.md`.

## 4. Documentación

- [x] 4.1 `docs/ci-pipeline.md`: agregar `dependency-audit` a la tabla de jobs y al diagrama del pipeline.
- [x] 4.2 `docs/hardening-roadmap.md`: cerrar la subsección 5.2, marcar sus checkboxes, y agregar el bloque `> **Hecha** el 2026-08-15, change \`audit-dependencies-in-ci\`. ...` con el umbral elegido y por qué, siguiendo el estilo de las fases ya cerradas (3.1, 4.1, 4.2).

## 5. Verificación local

- [x] 5.1 `npx nx affected -t lint test build --base=develop` (o el equivalente que corresponda) para confirmar que no se rompió nada fuera de `ci.yml`.
- [x] 5.2 `npm audit --audit-level=critical` desde la raíz, para confirmar el resultado esperado antes de pushear.

## 6. Pull request

- [x] 6.1 `git fetch origin && git rebase origin/develop` antes de abrir el PR — `ci.yml` es un archivo con alta probabilidad de haber cambiado desde que arrancó este change.
- [x] 6.2 Si hay conflicto en `ci.yml`, resolverlo a mano: el job nuevo se agrega, no reemplaza nada de lo existente.
- [x] 6.3 Abrir PR contra `develop` con `gh pr create`, mensaje en Conventional Commits.
