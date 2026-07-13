## Context

La app no tiene hoy ningún componente de tipo modal/overlay ni ningún contenido de ayuda. `apps/web/src/app/app.html` es solo un `<router-outlet>`, y `styles.scss` global está vacío (sin variables/tokens de diseño compartidos). `docs/idea.md` pedía originalmente Atomic Design con átomos/moléculas reusables y un sistema de temas, pero eso nunca se construyó — es una deuda separada, registrada en `docs/future-ideas.md`, que este cambio no intenta resolver.

Este cambio agrega contenido puramente informativo y estático (sin llamadas al backend ni mensajes WebSocket nuevos), pensado para tres audiencias que hoy no tienen ningún soporte en la app: quien participa por primera vez, quien modera, y equipos experimentados que necesitan recordar el propósito real de la técnica.

## Goals / Non-Goals

**Goals:**
- Un botón de ayuda persistente, definido una sola vez, visible en Home y en Room.
- Un panel modal con contenido estático en español, organizado en tres secciones por audiencia.
- Que abrir/cerrar el panel no interfiera con el estado de la sesión de estimación (voto propio, fase de la ronda, etc.).

**Non-Goals:**
- No se crean variables/tokens SCSS globales ni se resuelve el sistema de temas de `docs/idea.md` — el panel usa estilos locales a sus propios componentes.
- No se personaliza el contenido según el mazo elegido en la sala (Fibonacci vs. T-Shirt) — el contenido es genérico y fijo para todas las salas.
- No hay mecanismo de "mostrar automáticamente la primera vez" — el panel es solo bajo demanda (ver Decisión 3).
- No agrega telemetría ni tracking de si el panel fue visto.

## Decisions

### Decisión 1: Botón de ayuda global en `app.html`, no duplicado por página
Se agrega un componente `app-help-button` (FAB, `position: fixed`, esquina superior derecha) directamente en `apps/web/src/app/app.html`, junto al `<router-outlet>`, en vez de integrarlo al header de `room.html` y agregar un header nuevo en `home.html`.

**Alternativa considerada**: integrarlo al header de cada página (junto a `room__stats` en Room). Se descartó porque `home.html` no tiene hoy ningún header estructurado (solo un `<h1>`), y duplicar el botón en dos componentes distintos generaría dos lugares para mantener el mismo comportamiento.

### Decisión 2: Contenido estático en el propio componente, sin fuente de datos externa
El texto de las tres secciones vive como contenido fijo en el template del componente modal (`help-modal.html`), no en `shared-contracts` ni en una respuesta del backend. No hay necesidad de que el backend conozca este contenido: es puramente de presentación y no varía por sala ni por usuario.

### Decisión 3: Panel bajo demanda únicamente (sin auto-apertura la primera vez)
El panel solo se abre por acción explícita del usuario (click en el botón de ayuda). No se implementa apertura automática en el primer ingreso a una sala.

**Alternativa considerada**: mostrar el modal automáticamente la primera vez que alguien crea/entra a una sala, con opción de "no volver a mostrar" (requeriría persistir esa preferencia, probablemente en `localStorage`). Se descartó para este cambio por simplicidad y porque agrega estado a persistir sin un requisito claro que lo justifique; queda como posible iteración futura si se detecta que el botón bajo demanda no es suficientemente descubrible.

### Decisión 4: Tabs internos por audiencia (revisado)
Las tres secciones (nuevos, moderadores, recordatorio de propósito) se muestran como pestañas — se ve una sección a la vez, con el mismo patrón visual que `home__tabs` en `home.scss` (borde inferior activo).

**Decisión original (descartada durante implementación)**: una sola columna scrolleable con las tres secciones apiladas, sin tabs. Se abandonó porque el contenido final, ya enriquecido con buenas prácticas concretas de fuentes externas (ver `proposal.md`), resultó más extenso de lo previsto — una sola columna larga dificultaba encontrar la sección relevante de un vistazo. Los tabs resuelven eso sin costo adicional relevante, reutilizando un patrón visual ya existente en el proyecto (`home__tabs`) en vez de inventar uno nuevo.

### Decisión 5: Estilos locales al componente, sin tokens SCSS globales
`help-button.scss` y `help-modal.scss` definen sus propios valores (color de overlay, radios de borde, espaciados) sin extraer variables a `styles.scss`.

**Alternativa considerada**: aprovechar que este es el primer modal de la app para introducir tokens SCSS globales reutilizables. Se descartó (YAGNI) porque una sola pieza no justifica infraestructura nueva; se extraerán tokens cuando exista un segundo caso real de reuso. Esto se relaciona con la deuda de Atomic Design/theming de `docs/idea.md`, que queda fuera de alcance (ver Non-Goals) y registrada como exploración futura independiente.

## Risks / Trade-offs

- [Contenido genérico no personalizado por mazo] → Aceptado como limitación del primer corte; si se detecta que el contenido específico de Fibonacci vs. T-Shirt agrega valor real, se puede iterar después sin cambiar la estructura del panel.
- [Falta de auto-apertura la primera vez podría hacer que el botón pase desapercibido para usuarios nuevos] → Mitigado por la posición fija y visible del FAB en todo momento; si la descubribilidad resulta insuficiente en uso real, la Decisión 3 puede revisitarse.
- [Sin tokens globales, un futuro segundo modal duplicará parte del CSS de overlay/panel] → Aceptado (YAGNI); se resuelve extrayendo tokens cuando aparezca ese segundo caso, no antes.

