# Tests donde vive la lógica de dominio

## Why

`apps/realtime-api` tiene **cero tests** y `"passWithNoTests": true`. Ahí vive toda la lógica de negocio del producto: 10 acciones, el cálculo de promedio y moda, y las reglas de quién puede hacer qué.

No es una preocupación teórica. Dos changes archivados **son correcciones de esas reglas**:

| Change | Qué se rompió |
|---|---|
| `2026-07-11-fix-mode-numeric-only` | La moda se calculaba sobre mazos sin escala numérica |
| `2026-07-19-tshirt-numeric-resolution` | T-Shirt resolvía con la talla como texto en vez de su número interno |

Son reglas lo bastante sutiles como para haberse implementado mal una vez cada una, y hoy nada impide que vuelvan a romperse. Los 13 e2e cubren caminos felices de punta a punta; no la matriz de reglas.

**Por qué ahora**: la Fase 1 está cerrada. Los tests que se escriban acá corren en cada pull request y bloquean el merge si fallan — cosa que hace tres días no pasaba.

## What Changes

**Se extrae la única función de dominio que está escondida**
- `computeRevealResult` vive dentro de `reveal.ts` sin exportar, mezclada con el adaptador que habla con DynamoDB. Se mueve a `apps/realtime-api/src/lib/reveal-result.ts` **sin cambiar una línea de su lógica**. Es donde viven los dos bugs de arriba.

**Tests de las dos funciones puras, sin mocks**
- `computeRevealResult`: promedio, moda, empates, distribución, ajuste a la escala del mazo. Los casos de los dos changes archivados, explícitos.
- `maskRoomForViewer`: que un participante no vea los votos ajenos mientras la ronda no esté revelada. Si esto se rompe, el planning poker deja de funcionar como juego.

**Tests de los dos handlers que concentran las reglas**
- `reveal` y `vote`, con `aws-sdk-client-mock`. Camino feliz y camino de error: permiso denegado, estado inválido, sala inexistente.

**El target deja de mentir**
- Sale `"passWithNoTests": true` de `apps/realtime-api/project.json`. Con esa opción puesta, borrar todos los tests por accidente deja el target en verde.

## Capabilities

### Modified Capabilities

- `continuous-integration`: se agrega el requisito de que ningún proyecto declare que su verificación pasa sin tests. Es lo que hoy permite que `realtime-api` esté en verde con cero cobertura.

**No hay delta de comportamiento.** Las reglas que se van a testear ya están especificadas en `estimation-session` —*Votación oculta* y *Cálculo de promedio y moda*—. Este change agrega verificación, no funcionalidad.

## Impact

**Código**
- `apps/realtime-api/src/lib/reveal-result.ts` — nuevo, con la función movida tal cual.
- `apps/realtime-api/src/actions/reveal.ts` — pierde la función, la importa.
- `apps/realtime-api/project.json` — sale `passWithNoTests`.
- `package.json` — entra `aws-sdk-client-mock` como devDependency.

**Tests nuevos**: `reveal-result.spec.ts`, `room-repository.spec.ts`, `reveal.spec.ts`, `vote.spec.ts`.

**Sin cambios de comportamiento.** La extracción es un movimiento de código; los tests no tocan producción.

**Fuera de alcance**
- **Las otras 8 acciones.** `reveal` y `vote` concentran las reglas; el resto son adaptadores más finos y quedan para una segunda vuelta, anotada en el roadmap.
- **Fase 2.2 — integración contra DynamoDB Local.** Es su propio ítem y necesita infraestructura distinta.
- **Fase 2.3 — umbral de cobertura.** El umbral funciona como trinquete: se fija en el valor ya alcanzado. Fijarlo con dos handlers cubiertos mediría poco y habría que rehacerlo en la segunda vuelta.
