## Why

Dos fricciones de UI/UX detectadas y discutidas en `/opsx:explore`: (1) el botón "Aceptar promedio" en mazos Fibonacci/Fibonacci con manos/Powers of 2 puede ofrecer un valor que nunca fue una carta del mazo (ej. "2.7"), porque la regla que ajusta el promedio al valor de escala más cercano —introducida por `2026-07-19-tshirt-numeric-resolution`— se dejó explícitamente afuera de esos tres mazos en ese momento; (2) el link para compartir la sala se corta en dos líneas de forma poco prolija, porque comparte la mitad de un header `flex space-between` con las estadísticas de la sala, sin espacio suficiente para la URL real de producción.

## What Changes

- El promedio de una ronda se redondea siempre al valor más cercano de la escala del mazo, sea explícita (`numericValues`, como ya existe para T-Shirt) o implícita (los propios valores numéricos del mazo, para Fibonacci/Fibonacci con manos/Powers of 2). Deja de mostrarse un promedio crudo para estos tres mazos.
- El link para compartir la sala pasa a ocupar su propia fila de ancho completo en la pantalla de sala, en vez de compartir la mitad de una fila con las estadísticas.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `estimation-session`: los requirements "Cálculo de promedio y moda" y "Resolución manual de la historia" dejan de tratar la escala numérica interna como algo exclusivo de mazos no numéricos — todo mazo tiene una escala (explícita o implícita) para este cálculo.
- `room-management`: el requirement "Creación de sala" gana un criterio de legibilidad para el link compartible, además del ya existente sobre que sea una URL completa y funcional.

## Impact

- `apps/realtime-api/src/lib/reveal-result.ts`: `computeRevealResult` deja de gatear el ajuste de escala detrás de `if (numericValues)` — calcula una escala implícita a partir de los propios valores del mazo cuando no hay una explícita.
- `apps/realtime-api/src/lib/reveal-result.spec.ts`: cobertura para el ajuste de escala implícita en mazos numéricos.
- `apps/web/src/app/pages/room/room.html` y `room.scss`: el link compartible pasa a su propia fila de ancho completo.
