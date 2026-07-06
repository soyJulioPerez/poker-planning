## 1. Ícono de "esperando voto"

- [x] 1.1 Agregar el emoji ⏳ como prefijo del texto "esperando voto" en `participant-list.html`
- [x] 1.2 Verificar visualmente que el estado "esperando voto" y "✓ votó" mantienen un estilo consistente (ícono + texto)

## 2. Favicon

- [x] 2.1 Crear `apps/web/public/favicon.svg` con el emoji ♠️ centrado
- [x] 2.2 Actualizar el `<link rel="icon">` en `apps/web/src/index.html` para apuntar a `favicon.svg` (`type="image/svg+xml"`)
- [x] 2.3 Eliminar o dejar sin referenciar el `favicon.ico` genérico anterior

## 3. Título de la pestaña

- [x] 3.1 Cambiar `<title>web</title>` a `<title>Planning Poker</title>` en `apps/web/src/index.html`

## 4. Validación

- [x] 4.1 Probar en el navegador que la pestaña muestra el nuevo favicon ♠️ y el título "Planning Poker"
- [x] 4.2 Probar el flujo de votación en una sala y confirmar que el ícono ⏳ aparece para participantes sin voto emitido
