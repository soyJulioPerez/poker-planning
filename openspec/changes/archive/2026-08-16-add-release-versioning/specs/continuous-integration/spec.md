## ADDED Requirements

### Requirement: El título del pull request sigue Conventional Commits

El sistema SHALL verificar que el título de todo pull request contra `develop` o `master` siga el formato de Conventional Commits, y SHALL bloquear el merge si no cumple.

**Gramática exacta exigida**: `tipo: descripción`, donde `tipo` SHALL ser uno de los 11 tipos estándar de Conventional Commits: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`. El scope (`tipo(scope): descripción`) es OPCIONAL, no SHALL exigirse. El marcador de breaking change (`tipo!: descripción` o `tipo(scope)!: descripción`) es OPCIONAL, no SHALL exigirse. Verificado contra el historial real del repo: de los 11 tipos, 6 ya están en uso (`docs`, `feat`, `fix`, `test`, `chore`, `ci`), ninguno con scope ni con `!`.

Esta verificación SHALL aplicarse al título del pull request, no a los commits individuales de la rama — el repo usa squash merge como regla, y el mensaje del commit resultante en la rama de integración es el título del pull request, no ninguno de los commits que existieron durante el desarrollo.

#### Scenario: Un título mal formado bloquea el merge

- **WHEN** se abre o actualiza un pull request cuyo título no sigue el formato Conventional Commits
- **THEN** el check correspondiente falla y el botón de merge queda bloqueado

#### Scenario: Los commits individuales de la rama no se verifican

- **WHEN** una rama de un pull request tiene commits que no siguen Conventional Commits (por ejemplo, "wip", "arreglo typo")
- **THEN** el check no falla por eso, siempre que el título del pull request sí cumpla el formato

#### Scenario: Un título bien formado permite el merge

- **WHEN** el título del pull request sigue el formato Conventional Commits
- **THEN** el check pasa, independientemente del contenido de los commits individuales de la rama
