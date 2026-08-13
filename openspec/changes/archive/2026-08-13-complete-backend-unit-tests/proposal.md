# El servidor deja de confiar en la interfaz

## Why

La primera vuelta de la Fase 2.1 cubrió `reveal`, `vote` y la defensa de `resolve-story`. Al hacerlo aparecieron **dos huecos de validación en `handleVote`**, y los dos tienen la misma forma:

```
                        interfaz        servidor
  no-votante vota       lo impide  ✓    lo acepta  ✗
  votar tras revelar    lo impide  ✓    lo acepta  ✗
```

La web ya cumple las dos reglas —el mazo no se pinta cuando la ronda está revelada, y va `disabled` para quien no es votante— pero el servidor no comprueba ninguna. Un mensaje que llegue sin pasar por esa interfaz entra igual.

**Hay un precedente literal en este repositorio.** El change `2026-07-11-fix-mode-numeric-only` corrigió la interfaz **y además** agregó la validación en el servidor, textual: *"como defensa adicional independiente de la UI"*. Este change aplica el mismo criterio a las dos reglas que quedaron sin él.

Y de paso completa la cobertura: quedan 8 acciones sin un solo test.

## What Changes

**El servidor valida quién puede votar**
- `handleVote` rechaza el voto de un participante cuyo `isVoter` es falso. La regla **ya está especificada** en `estimation-session` (*"cada participante habilitado para votar"*); lo que faltaba era cumplirla.

**El servidor valida cuándo se puede votar**
- `handleVote` rechaza el voto cuando la ronda ya está revelada. Esta regla **no estaba escrita** en ningún lado: la interfaz la aplicaba y el spec callaba. Se decide que se rechaza, y se escribe.

**Se completa la cobertura de las 8 acciones restantes**
- `join-room`, `set-moderator-is-voter`, `create-room`, `new-round`, `next-story`, `close-room`, `get-room-info`, y el camino completo de `resolve-story`.
- El patrón de mockeo ya está montado desde la primera vuelta, así que es trabajo mecánico.

**Sin cambios en la web.** Las dos reglas ya se cumplen ahí. Este change solo cierra la puerta de atrás.

## Capabilities

### Modified Capabilities

- `estimation-session`: el requirement *"Votación oculta"* enuncia hoy quién puede votar, pero no dice qué pasa cuando alguien que no debería lo intenta, ni hasta cuándo se acepta un voto. Se agregan las dos reglas y se explicita que el servidor las hace cumplir por su cuenta, sin depender de la interfaz.

## Impact

**Código**
- `apps/realtime-api/src/actions/vote.ts` — dos guardas nuevas.

**Tests nuevos**: 8 archivos `*.spec.ts` en `actions/`, más los dos `it.todo` de `vote.spec.ts` que pasan a ser tests reales.

**Documentación**
- `docs/known-issues.md` — se cierra la entrada del hueco de `isVoter`.
- `docs/hardening-roadmap.md` — cierre de la Fase 2.1.

**Fuera de alcance**
- **Fase 2.2 — integración contra DynamoDB Local.** Su propio ítem, con infraestructura distinta.
- **Fase 2.3 — umbral de cobertura.** Es el paso natural siguiente a este change, no parte de él: el trinquete se fija sobre el valor alcanzado, así que primero hay que alcanzarlo.
