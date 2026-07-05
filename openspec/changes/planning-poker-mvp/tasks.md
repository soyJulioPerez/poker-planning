## 1. Fundacion del monorepo

- [x] 1.1 Inicializar workspace Nx con apps `web` (Angular) y `realtime-api` (Lambdas), y lib `shared/contracts`
- [x] 1.2 Configurar tipos TypeScript compartidos en `shared/contracts` para mensajes WebSocket (join, vote, reveal, resolve, nextStory) y modelos de dominio (Room, Participant, Story)
- [x] 1.3 Definir infraestructura base: tabla DynamoDB single-table (con TTL) y WebSocket API Gateway (rutas `$connect`, `$disconnect`, `$default`)
- [x] 1.4 Configurar despliegue local/dev (ej. serverless-offline o equivalente) para poder probar Lambdas + WebSocket sin desplegar a la nube en cada cambio

## 2. Incremento 1: Crear sala + unirse + lista de participantes en vivo

- [x] 2.1 Lambda `connect`: registrar conexión WebSocket entrante en la tabla (`CONN#<connectionId>`)
- [x] 2.2 Lambda de acción `createRoom`: generar `roomId`, crear ítem `ROOM#<roomId>#META` con moderador y TTL, devolver link/código
- [x] 2.3 Lambda de acción `joinRoom`: validar nombre único entre participantes conectados, crear/reutilizar ítem `PARTICIPANT#<name>`, hacer broadcast de la lista actualizada a la sala
- [x] 2.4 Lambda `disconnect`: marcar al participante correspondiente como "desconectado" (sin eliminarlo) y notificar a la sala
- [x] 2.5 Frontend: pantalla "Crear sala" (átomo/molécula de formulario, generación de link/código)
- [x] 2.6 Frontend: pantalla "Unirse a sala" con input de nombre y manejo de error por nombre duplicado
- [x] 2.7 Frontend: componente de lista de participantes en vivo, con badge visual para el moderador y estado "desconectado"
- [x] 2.8 Verificar manualmente en navegador: crear sala, unirse desde dos pestañas/navegadores distintos, ver lista en vivo actualizarse

## 3. Incremento 2: Votacion + revelado + promedio/moda

- [ ] 3.1 Definir catálogo de mazos predefinidos (Fibonacci y variantes) en `shared/contracts`
- [ ] 3.2 Frontend: selector de mazo al crear sala
- [ ] 3.3 Lambda de acción `vote`: registrar voto oculto del participante para la historia actual, notificar a la sala que el participante votó (sin revelar valor)
- [ ] 3.4 Lambda de acción `reveal` (solo moderador): calcular promedio y moda de votos numéricos, hacer broadcast de todos los votos y las métricas calculadas
- [ ] 3.5 Frontend: componente de carta de votación (átomo) y tablero de votación oculta (mostrar "ya votó" sin valor)
- [ ] 3.6 Frontend: vista de revelado con distribución de votos, promedio y moda
- [ ] 3.7 Backend: validar que solo el moderador puede ejecutar `reveal`
- [ ] 3.8 Verificar manualmente en navegador: votar desde varias sesiones, revelar, confirmar cálculo correcto de promedio/moda

## 4. Incremento 3: Resolucion de historia + nueva ronda + contadores acumulados

- [ ] 4.1 Lambda de acción `resolveStory` (solo moderador): aceptar promedio, aceptar moda, o valor manual como puntuación definitiva; persistir historia resuelta en el estado de la sala
- [ ] 4.2 Lambda de acción `newRound` (solo moderador): descartar votos de la ronda actual sin resolver la historia
- [ ] 4.3 Lambda de acción `nextStory` (solo moderador): avanzar a nueva historia reiniciando estado de votación
- [ ] 4.4 Backend: actualizar contador de historias estimadas y puntuación acumulada en el ítem de sala al resolver cada historia
- [ ] 4.5 Backend: bloquear cambio de "moderador vota o no" si la ronda no está en estado `idle` (validación server-side)
- [ ] 4.6 Frontend: controles de resolución para el moderador (aceptar promedio/moda, input de valor manual, nueva ronda, siguiente historia)
- [ ] 4.7 Frontend: toggle de "el moderador vota" deshabilitado durante ronda activa
- [ ] 4.8 Frontend: panel visible de contador de historias + puntuación acumulada durante la sesión
- [ ] 4.9 Verificar manualmente en navegador: resolver varias historias seguidas, confirmar que contadores y bloqueo de toggle funcionan como se espera

## 5. Incremento 4: Reconexion + resumen final

- [ ] 5.1 Backend: lógica de reconexión por nombre+sala en `joinRoom` (reutilizar ítem de participante existente, restaurar voto/estado si la ronda sigue activa)
- [ ] 5.2 Backend: acción `closeRoom` (solo moderador): generar resumen final (lista de historias con puntuación definitiva + total) y hacer broadcast a la sala
- [ ] 5.3 Frontend: manejo de reconexión transparente (reintento de conexión WebSocket, re-unión automática con nombre guardado en la sesión del navegador)
- [ ] 5.4 Frontend: pantalla/panel de resumen final con lista de historias, puntuación de cada una, y total acumulado
- [ ] 5.5 Verificar manualmente en navegador: simular pérdida de conexión (recargar pestaña) y confirmar reconexión sin perder el voto; cerrar sala y confirmar resumen final correcto

## 6. Cierre

- [ ] 6.1 Documentar en el README del proyecto el flujo de uso (crear sala, compartir link, votar, cerrar sala) y la deuda técnica de identidad por nombre+sala
- [ ] 6.2 Revisión final de los 4 incrementos end-to-end en una sola sesión de prueba con múltiples participantes simulados
