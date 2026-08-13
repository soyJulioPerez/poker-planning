# Diseño — El portón deja de ser una convención

## Context

Hoy, cualquiera con acceso de escritura puede hacer esto:

```
git commit -m "arreglo rápido"
git push origin master
```

Y el sitio se actualiza en producción sin que se haya ejecutado una sola prueba.

Las Fases 1.1 y 1.2 construyeron la verificación —`verify` (~2 min) y `e2e` (~15 s de suite)— y la pusieron delante de los despliegues. Funciona y está en verde. **Lo único que falta es que sea obligatorio pasar por ahí.**

Estado verificado antes de escribir esto:

| | |
|---|---|
| `master` protegido | no |
| `develop` protegido | no |
| Checks que aparecen en un pull request | `verify`, `e2e`, `deploy-backend`, `deploy-web` |
| Visibilidad del repositorio | público — la protección de ramas no tiene costo |
| Personas con acceso de escritura | una |

## Goals / Non-Goals

**Goals:**

- Que sea imposible —no solo desaconsejado— meter código sin verificar en `develop` y `master`.
- Que la regla aplique a todos, incluido quien administra el repositorio.
- Que las reglas queden escritas en `docs/`, no solo en la pantalla de Settings.
- Que el flujo de release siga funcionando, adaptado.

**Non-Goals:**

- **Aprobaciones requeridas.** Ver Decisión 3.
- **`CODEOWNERS`** — Fase 7.2.
- **Proteger `release/*`.**
- **Cambiar la topología de ramas.** Este repositorio sigue con Git Flow; es una decisión deliberada, tomada sabiendo cuáles son sus costos.

## El flujo resultante, paso a paso

Cuatro momentos del sprint. En cada uno: qué hacés y qué ves.

### 1. Tomar una historia

```
  develop        ──●──────────────────────────────●──────────▶
                   │                              ▲
              cut  │                              │  squash
                   ▼                              │
  feature/HU-123   ●──●──●───────────────────────▶┘
```

| Hacés | Ves |
|---|---|
| `git checkout -b feature/HU-123 develop` | — |
| Trabajás y commiteás libremente, sin cuidar la forma | — |
| `git push -u origin feature/HU-123` | Nada especial: la rama no está protegida |
| Abrís el pull request contra `develop` | Dos checks corriendo: **verify** y **e2e** |
| Esperás | El botón **Merge pull request** está **gris** hasta que los dos estén en verde |
| Mergeás con **Squash and merge** | `develop` queda con **un commit por historia**; los "fix typo" desaparecen |

**Lo que cambia respecto de hoy**: hasta ahora podías saltarte el pull request y commitear directo a `develop`. Esa excepción está escrita en `conventions.md` y vence con esta fase.

### 2. Cortar el release del sprint

```
  develop        ──●──────────────────────────────────────────▶
                   │
              cut  │
                   ▼
  release/1.5.0    ●            ──▶ ambiente QA
```

| Hacés | Ves |
|---|---|
| `git checkout -b release/1.5.0 develop` | — |
| `git push -u origin release/1.5.0` | Se ejecutan **verify** y **e2e**, y el backend se despliega al ambiente **qa** |

**Lo que cambia respecto de hoy**: nada. Cortar una rama no está afectado por la protección.

### 3. Corregir durante la estabilización

```
  release/1.5.0    ●──●──●      ──▶ QA se redespliega en cada push
```

| Hacés | Ves |
|---|---|
| Commiteás directo sobre `release/1.5.0` y pusheás | El push **se acepta**: esta rama no está protegida |
| — | Cada push vuelve a verificar y redespliega `qa` |

**Lo que cambia respecto de hoy**: nada. Es deliberado — es el momento de menos paciencia para la ceremonia de un pull request (Decisión 5).

### 4. Pasar a producción

```
  release/1.5.0    ●──●──●
                         │  merge commit
                         ▼
  master         ──●─────M──────────────────────▶  ──▶ PRODUCCIÓN
                         └ tag v1.5.0
```

| Hacés | Ves |
|---|---|
| Abrís un pull request de `release/1.5.0` a `master` | Los mismos dos checks: **verify** y **e2e** |
| Si `master` avanzó mientras tanto | GitHub te pide **actualizar la rama** antes de habilitar el merge |
| Mergeás con **Create a merge commit** | El despliegue a **producción** arranca solo, después del merge |
| Creás el tag `v1.5.0` sobre el commit de merge | — |

**Lo que cambia respecto de hoy**, y es el cambio más visible del change:

```
   ANTES                                    AHORA

   git merge --ff-only release/1.5.0        abrís un pull request
   git tag v1.5.0                           mergeás con merge commit
   git push origin master --tags            taggeás sobre el merge
```

Ver Decisión 4 para el porqué de cada pieza.

## Lo que te va a rechazar

```
  git push origin develop     →  remote: rejected — protected branch
  git push origin master      →  remote: rejected — protected branch

  mergear con un check en rojo      →  el botón queda gris
  mergear con la rama desactualizada →  GitHub pide actualizarla primero
  saltearte las reglas por ser admin →  no hay excepción
```

Y lo que sigue igual: trabajar en una rama corta, cortar la release del sprint, corregir sobre ella durante la estabilización, y ver QA actualizarse en cada push.

## Decisions

### Decisión 1: protección clásica, no rulesets

GitHub ofrece dos mecanismos: *branch protection rules* (clásico) y *rulesets* (nuevo, más expresivo).

**Elegido**: protección clásica.

Cubre todo lo que necesita esta fase y se configura con una sola llamada por rama. Los rulesets aportan cosas que acá no hacen falta: reglas por patrón con prioridades, bypass por equipo, y **métodos de merge por rama**.

Ese último es el único que se extraña. En GitHub, qué botones de merge aparecen se configura **por repositorio**, no por rama. O sea que no se puede forzar "en `develop` solo Squash, en `master` solo Merge commit": los tres botones van a estar disponibles en los dos lados, y elegir el correcto queda como convención escrita.

**Es una debilidad conocida y aceptada**: el costo de equivocarse es un commit con la forma equivocada, no código sin verificar. Si en la práctica se elige mal seguido, migrar a rulesets es el siguiente paso y no hay que rehacer nada.

### Decisión 2: qué checks bloquean el botón de merge

En cualquier pull request vas a ver **cuatro** checks. Solo dos deciden si podés mergear:

```
  verify          ✅  BLOQUEA el merge si falla
  e2e             ✅  BLOQUEA el merge si falla
  deploy-backend  ⊘   aparece como "Skipped" — informativo
  deploy-web      ⊘   aparece como "Skipped" — informativo
```

**Los deploys aparecen en gris con "Skipped" en todos los pull requests.** No es un error: no se despliega desde una rama que todavía no se mergeó. Se ejecutan **después**, cuando mergeás, y ahí sí actualizan el ambiente que corresponda.

**Elegido**: exigir `verify` y `e2e`; no exigir los de deploy.

Por dos razones, y las dos importan:

**Práctica.** Si marcás un deploy como obligatorio, GitHub se queda esperando un resultado que en un pull request nunca llega, y el botón de merge queda gris para siempre. El síntoma —"está todo verde y no me deja mergear"— no dice cuál es la causa. Es el error clásico al configurar esto por primera vez.

**Conceptual.** `verify` y `e2e` responden *"¿esto está bien?"*. Los deploys son lo que pasa **después** de decidir que sí. Solo lo primero tiene sentido como condición para mergear.

**Por qué los checks corren dos veces** —una en el pull request y otra después de mergear—: con *Squash and merge*, el commit que queda en `develop` es **nuevo**, lo arma GitHub al mergear, y nadie lo probó como tal. Está decidido así desde la Fase 1.1.

### Decisión 3: cero aprobaciones requeridas, por ahora

Lo natural sería exigir una aprobación. No se puede: **GitHub no te deja aprobar tu propio pull request**, y hoy hay una sola persona con acceso de escritura. Con una aprobación requerida, ningún pull request se podría mergear nunca.

**Elegido**: 0 aprobaciones, y anotarlo como lo primero a cambiar cuando entre una segunda persona.

Esto deja una asimetría que conviene nombrar: **la protección garantiza que el código esté verificado, no que esté revisado.** Lo primero lo hace la máquina y ya funciona. Lo segundo necesita otra persona, y ninguna configuración lo suple.

### Decisión 4: la promoción a `master` pasa de push a pull request

Es la consecuencia con más impacto en el día a día. Tres cosas cambian, y cada una tiene su razón.

**Desaparece el `--ff-only`.** No estaba por prolijidad: ese comando **falla** si `master` avanzó por otro lado, y esa falla era la señal de que algo se salió del flujo. Ahora esa alarma la da GitHub: si la rama de release quedó desactualizada, el merge no se habilita hasta que la actualices. Mismo aviso, en la interfaz en vez de en la terminal.

**Aparece un merge commit en `master`.** No es ruido: es el marcador del release. `git log --first-parent master` te da **una línea por release**, y el pull request queda como acta de qué entró.

**Hay que elegir *Create a merge commit*, no las otras dos opciones.** Un pull request de GitHub no puede hacer fast-forward — las tres opciones son merge commit, squash o rebase. De las tres, solo *merge commit* **conserva tal cual** los commits que pasaron por QA; *Squash* los colapsa en uno nuevo y *Rebase* los reescribe con otro identificador. Como el tag `v1.5.0` va sobre `master`, con las otras dos estaría marcando código que nunca existió en QA.

### Decisión 5: las ramas de release no se protegen

Son efímeras, viven dos semanas, y ahí caen los fixes de estabilización del primer día del sprint siguiente — el momento de menos paciencia para la ceremonia de un pull request.

**El riesgo está acotado**: nada llega a producción desde una rama de release sin pasar por el pull request a `master`, que sí está protegido. Lo que se pushee directo a `release/*` se verifica igual —los checks corren en esa rama— solo que sin bloquear el push.

Si más adelante varias personas tocan la misma rama de release, se revisa.

## Risks / Trade-offs

**[Quedarte afuera de tu propio repositorio]** → Con las reglas aplicadas también a admins y algo mal configurado, no habría forma de mergear nada. Mitigación: la protección se desactiva desde Settings en cualquier momento, y el orden de las tareas deja `develop` protegido y verificado antes de tocar `master`.

**[El flujo de release documentado deja de funcionar tal cual está escrito]** → Es el riesgo más caro porque se descubre el día que hace falta cortar un release, con el sprint encima. Por eso la actualización de `git-branching-strategy.md` es parte del change y no una tarea posterior.

**[Elegir el botón de merge equivocado]** → Ver Decisión 1. GitHub va a ofrecer los tres en las dos ramas; cuál corresponde queda escrito en la documentación, no forzado por la herramienta.

**[La configuración no está versionada]** → La protección vive en GitHub, no en el repositorio: un cambio en Settings no deja rastro en la historia del proyecto. Mitigación parcial: documentar las reglas en `docs/` junto con el comando que las lee, para poder auditar en un paso.

## Migration Plan

1. Proteger `develop` y comprobarlo contra un pull request real.
2. Proteger `master` con las mismas reglas.
3. Comprobar los tres rechazos: push directo, merge con un check en rojo, merge con la rama desactualizada.
4. Actualizar la documentación.

**Rollback**: desactivar la protección desde Settings. No hay estado que migrar.

## Open Questions

Ninguna de alcance.

Queda una decisión **con fecha, no con duda**: subir las aprobaciones requeridas a 1 en cuanto haya una segunda persona con acceso de escritura. Anotado en el roadmap y en `git-branching-strategy.md` para que no dependa de que alguien se acuerde.
