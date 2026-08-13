# Tareas — El portón deja de ser una convención

> **`develop` va antes que `master`.** Si algo queda mal configurado, conviene descubrirlo
> en la rama de integración y no en la que despliega a producción.
>
> Todo se aplica con `gh api`. La protección se puede desactivar en cualquier momento desde
> Settings o con `gh api -X DELETE`, así que ningún paso es irreversible.

## 1. Punto de partida

- [x] 1.1 Confirmar que hoy no hay nada: `gh api repos/:owner/:repo/branches/develop --jq .protected` y lo mismo para `master`. Los dos deben dar `false`.
- [x] 1.2 Confirmar los nombres exactos de los checks tal como GitHub los ve: `gh api repos/:owner/:repo/commits/master/check-runs --jq '.check_runs[].name'`. Deben aparecer `verify` y `e2e`. Un nombre mal escrito en la configuración deja el pull request esperando un check que no existe.

## 2. Proteger `develop`

- [x] 2.1 Aplicar la protección: pull request obligatorio, checks `verify` y `e2e` requeridos, ramas al día antes de mergear, `enforce_admins` activo, 0 aprobaciones requeridas.
- [x] 2.2 Confirmar que quedó: `gh api repos/:owner/:repo/branches/develop/protection` y revisar que los checks listados sean exactamente los dos.
- [ ] 2.3 **Verificar el negativo**: intentar un push directo a `develop` y confirmar que GitHub lo rechaza. Es la prueba de que la excepción de `conventions.md` dejó de ser posible.
- [ ] 2.4 Abrir un pull request cualquiera y confirmar que el botón de merge se habilita **solo** cuando `verify` y `e2e` están en verde.
- [ ] 2.5 **Verificar que un deploy salteado no bloquea**: el mismo pull request tiene `deploy-backend` y `deploy-web` en `skipped`. Confirmar que se puede mergear igual. Es la trampa de la Decisión 2.

## 3. Proteger `master`

- [ ] 3.1 Aplicar la misma configuración que en `develop`.
- [ ] 3.2 Confirmar que quedó, con la misma lectura que 2.2.
- [ ] 3.3 **Verificar el negativo**: intentar `git push origin master` y confirmar el rechazo. Este es el push que hasta ayer desplegaba a producción sin verificar nada.

## 4. El flujo de release, adaptado

- [ ] 4.1 Reescribir el paso 4 de `docs/git-branching-strategy.md`: la promoción pasa de `git merge --ff-only` + `git push` a un pull request de `release/*` a `master` con merge commit.
- [ ] 4.2 Documentar dónde va el tag ahora: sobre el commit de merge en `master`, después de mergear el pull request.
- [ ] 4.3 Explicar qué reemplaza al `--ff-only`: la opción *"Require branches to be up to date before merging"*, que da la misma garantía —fallar si `master` avanzó por otro lado— aplicada por GitHub en vez de por el comando.
- [ ] 4.4 Anotar por qué el merge es con **merge commit** y no con squash ni rebase: es la única de las tres opciones que conserva los commits que pasaron por QA sin reescribirlos.

## 5. Documentación

- [ ] 5.1 `docs/git-branching-strategy.md`: eliminar la frase *"no hay branch protection rules configuradas todavía"* de la línea 5 y reemplazarla por qué reglas quedaron.
- [ ] 5.2 `docs/conventions.md`: eliminar la sección *"Commit directo a `develop` — excepción temporal"*. Está escrita con vencimiento en esta fase.
- [ ] 5.3 Documentar el comando que **lee** la configuración vigente (`gh api .../protection`), para poder auditar las reglas sin entrar a Settings. La protección no está versionada; esto es lo más cerca que se llega.
- [ ] 5.4 Dejar anotado, en `git-branching-strategy.md` y en el roadmap, que las aprobaciones requeridas suben a 1 cuando entre una segunda persona con acceso de escritura. Es una decisión con fecha, no una duda.
- [ ] 5.5 `docs/hardening-roadmap.md`: cerrar la Fase 1.3, marcar sus criterios de aceptación y anotar qué quedó distinto de lo anticipado — sobre todo que los checks obligatorios son **dos** (`verify` y `e2e`), no uno.

## 6. Cierre

- [ ] 6.1 Confirmar que el flujo completo sigue funcionando de punta a punta: un pull request a `develop` que se mergea con las reglas puestas.
- [ ] 6.2 Confirmar que la Fase 1 queda cerrada entera (1.1, 1.2 y 1.3) en la tabla de estado del roadmap.
