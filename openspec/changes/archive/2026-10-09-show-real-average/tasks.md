## 1. Contrato compartido

- [x] 1.1 `packages/shared-contracts/src/lib/domain.ts`: agregar `rawAverage: number | null` y `averageBounds: number[]` a `RevealResult`, con un comentario que aclare que `average` sigue siendo la carta más cercana y lo usa mobile.
- [x] 1.2 Actualizar los fixtures y specs que construyen un `RevealResult` (web, mobile, realtime-api) para que compilen con los campos nuevos.

## 2. Servidor: promedio real y cartas vecinas

- [x] 2.1 `apps/realtime-api/src/lib/reveal-result.ts`: calcular `rawAverage` (redondeado a 2 decimales) y `averageBounds` según D2, sin cambiar el cálculo de `average`.
- [x] 2.2 `reveal-result.spec.ts`: Fibonacci 8, 8, 13 → `rawAverage` 9.67 y `averageBounds` [8, 13]; 8, 8, 8 → [8]; T-Shirt entre M y L → [4, 8]; T-Shirt que coincide con M → [4]; sin votos numéricos → `null` y []; `average` sigue igual que antes en todos los casos.

## 3. Web: promedio y botones

- [x] 3.1 `apps/web/src/app/pages/room/room.ts`: `computed` para el texto del promedio (D3, `Intl.NumberFormat('es-AR')`, escala explícita con `valueLabel`) y para las cartas vecinas, con el fallback de D5 para un `revealResult` sin campos nuevos.
- [x] 3.2 `apps/web/src/app/pages/room/room.html`: línea "Promedio: …" visible para todos tras el revelado; en `room__resolution`, reemplazar "Aceptar promedio (X)" por un botón "Aceptar {etiqueta}" por cada carta vecina. El botón de moda queda igual.
- [x] 3.3 `room.spec.ts`: "Promedio: 9,67" con botones "Aceptar 8" y "Aceptar 13"; "Promedio: 8" con un solo botón; T-Shirt "Promedio: entre M y L" con "Aceptar M" / "Aceptar L"; quien no modera ve el promedio pero no los botones; elegir una vecina envía `resolveStory` con su valor; `revealResult` sin campos nuevos usa `[average]`.

- [x] 3.4 **(pedido en la verificación manual)** `room.ts`/`room.html`: ocultar "Aceptar moda (X)" cuando X ya es una carta vecina del promedio (`acceptableMode`). Spec, proposal y design actualizados; tests en `room.spec.ts`.
- [x] 3.5 **(pedido en la verificación manual)** `reveal-panel`: el promedio pasa a la línea de estadísticas del panel (input `average`), antes de la moda empatada, en vez de una línea propia en `room.html`. Tests en `reveal-panel.spec.ts`.
- [x] 3.6 **(descubierta en el CI del PR)** `e2e/`: los specs y el page object buscaban "Aceptar promedio (X)"; pasan a validar "Promedio: …" y los botones de cartas vecinas. El caso de moda de T-Shirt usa tres votos, porque con dos una moda única coincide con el promedio y su botón se oculta.

## 4. Verificación

- [x] 4.1 `npx nx run-many -t lint test build` en los proyectos afectados.
- [x] 4.2 Manual contra el stack local: Fibonacci 8, 8, 13; 8, 8, 8; T-Shirt con votos entre dos tallas; resolver con cada botón y ver la historia resuelta con el valor elegido. Verificado por el usuario contra el stack local (2026-10-09).
