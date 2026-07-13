## 1. Componente del botón de ayuda

- [x] 1.1 Crear `apps/web/src/app/ui/help-button/` (`help-button.ts`, `.html`, `.scss`) como componente standalone, con un `output()` (ej. `opened`) o estado interno para abrir el modal
- [x] 1.2 Estilo del botón como FAB: `position: fixed`, esquina superior derecha, ícono "?" o "💡" consistente con el tono emoji del resto de la app (favicon ♠️, ⏳ de "no votó")

## 2. Componente del panel de ayuda (modal)

- [x] 2.1 Crear `apps/web/src/app/ui/help-modal/` (`help-modal.ts`, `.html`, `.scss`) como componente standalone, con un `output()` de cierre (ej. `closed`)
- [x] 2.2 Estructura del modal: overlay + panel con título "Guía de estimación" y botón "✕"
- [x] 2.3 Contenido estático en el template, organizado en tabs (una sección visible a la vez, patrón visual de `home__tabs`), con las tres secciones definidas en la spec, respaldadas por buenas prácticas de fuentes externas (Mountain Goat Software/Mike Cohn, Atlassian, Asana, Scrum.org):
  - "Si sos nuevo" (qué es Planning Poker, por qué votar en secreto, puntos vs. tiempo, estimación relativa/triangulación, por qué Fibonacci no es lineal, qué significan "?" y "☕")
  - "Si moderás" (esperar todos los votos antes de revelar, cómo manejar dispersión de votos empezando por los extremos, no promediar extremos, qué hacer si no converge, por qué quien modera idealmente no vota)
  - "Ya con experiencia" (objetivo de entendimiento compartido, dispersión como señal de desalineación, no convertir puntos a horas, calibrar con historias pasadas)
- [x] 2.4 Cierre al hacer click en "✕"
- [x] 2.5 Cierre al hacer click en el overlay (fuera del contenido del panel)
- [x] 2.6 Cierre al presionar la tecla Esc (listener de teclado mientras el modal está abierto)
- [x] 2.7 Estilos locales al componente (overlay semitransparente, radios de borde, espaciados, tabs) sin tocar `styles.scss` global

## 3. Integración en el shell raíz

- [x] 3.1 Agregar `<app-help-button>` en `apps/web/src/app/app.html`, junto al `<router-outlet>`
- [x] 3.2 Conectar la apertura/cierre entre `app-help-button` y `app-help-modal` (estado en `app.ts` o manejado localmente entre ambos componentes)
- [x] 3.3 Verificar visualmente que el botón aparece tanto en Home como dentro de una sala (todas las fases: esperando historia, votando, votos revelados, resumen final), sin superponerse con otros controles existentes (ej. `room__close-btn`) — verificado manualmente por el usuario

## 4. Verificación

- [x] 4.1 Confirmar que abrir/cerrar el panel durante una ronda de votación activa no altera el voto propio ni la fase de la ronda (verificación manual en `apps/web`) — verificado manualmente por el usuario
- [x] 4.2 Revisar que el contenido esté en español, consistente con el resto de la UI
- [x] 4.3 Correr lint de `apps/web` para confirmar que no se rompió nada (`npm exec nx lint web`); los tests unitarios de componentes Angular no corren por la deuda técnica ya documentada en `docs/known-issues.md`
