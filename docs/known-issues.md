# Problemas conocidos

## Test runner de componentes Angular roto (vitest-analog)

**Síntoma**: `npx nx run web:vite:test` falla con `Error: Need to call TestBed.initTestEnvironment() first` y `TypeError: Cannot read properties of null (reading 'ngModule')` en cualquier spec que use `TestBed` (incluido el spec `app.spec.ts` generado por el propio scaffold de Nx, sin modificar).

**Causa probable**: incompatibilidad de versiones entre Angular `21.2.9` (muy reciente) y `@analogjs/vitest-angular@2.2.0` / `@analogjs/vite-plugin-angular@2.2.0`, que el generador de Nx instaló como parte del preset `unitTestRunner=vitest-analog`.

**Confirmado que no es un problema de código propio**: un test trivial sin `TestBed` (`expect(1+1).toBe(2)`) pasa sin problemas en el mismo archivo/proyecto. Solo falla la inicialización de `TestBed`.

**Impacto**: no se pueden correr tests unitarios de componentes Angular por ahora. El build de producción (`nx build web`) y el dev server (`nx serve web`) funcionan con normalidad — no es un problema del código de la aplicación, solo del test runner.

**Decisión**: se deja como deuda técnica anotada. La verificación de cada incremento del MVP se hace manualmente en el navegador (como pide `tasks.md`), no depende de estos tests.

**Posibles soluciones a futuro** (no aplicadas):
- Fijar una versión de Angular más antigua y probada contra `@analogjs/vitest-angular`.
- Actualizar `@analogjs/vitest-angular` a una versión más nueva cuando exista soporte confirmado para Angular 21.x.
- Migrar el test runner de `web` a Jest con `@angular-builders/jest` u otra combinación más estable, si el problema persiste.
