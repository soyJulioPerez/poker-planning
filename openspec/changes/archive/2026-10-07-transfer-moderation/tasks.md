## 1. Contrato compartido

- [x] 1.1 `packages/shared-contracts/src/lib/messages.ts`: agregar `TransferModerationRequest { action: 'transferModeration'; roomId; targetName }` y `ClaimModerationRequest { action: 'claimModeration'; roomId }`, e incluirlos en la unión `ClientRequest`.
- [x] 1.2 `packages/shared-contracts/src/lib/domain.ts`: agregar `disconnectedAt: number | null` a `Participant`.
- [x] 1.3 Actualizar fixtures y fakes que construyen `Participant` (`action.fixtures.ts`, `apps/web/src/app/testing`, specs de web y mobile) para que compilen con el campo nuevo.

## 2. Servidor: marca de desconexión

- [x] 2.1 `apps/realtime-api/src/handlers/disconnect.ts`: `SET connected = :false, disconnectedAt = :now`.
- [x] 2.2 `apps/realtime-api/src/main.ts` (`handleDisconnect`): el mismo cambio para el servidor local.
- [x] 2.3 `apps/realtime-api/src/lib/room-repository.ts`: agregar `disconnectedAt` al tipo del ítem y mapearlo en `toParticipant` (`?? null`).
- [x] 2.4 `disconnect.spec.ts` y `room-repository.spec.ts`: cubrir que se guarda `disconnectedAt` y que se expone en el `Room`.
- [x] 2.5 `join-room.spec.ts`: cubrir que el reingreso deja al participante sin `disconnectedAt`.

## 3. Servidor: ceder la moderación

- [x] 3.1 `apps/realtime-api/src/actions/transfer-moderation.ts`: validar sala existente, que quien llama sea `META.moderatorName`, que `targetName` exista, esté conectado y sea distinto de quien llama; ejecutar el `TransactWriteCommand` de D2 (variante transfer); responder `error` si falla la validación o la transacción; broadcast de `roomState` si tiene éxito.
- [x] 3.2 `transfer-moderation.spec.ts`: cesión exitosa (META, ambos participantes con `isVoter = true`, ronda intacta), cesión durante votación en curso, no moderador intenta ceder, destino desconectado, destino inexistente, ceder a sí mismo, transacción cancelada.
- [x] 3.3 Rutear `transferModeration` en `handlers/default.ts` y `main.ts`. **(ajuste)** `default.spec.ts` no prueba el ruteo de ninguna acción (solo el evento malformado), así que no se agregó un caso: el ruteo queda cubierto por typecheck sobre la unión `ClientRequest`.

## 4. Servidor: tomar la moderación

- [x] 4.1 `apps/realtime-api/src/actions/claim-moderation.ts`: validar sala existente, que quien llama esté en la sala y no sea el moderador, que el moderador esté desconectado hace ≥ 60 s o sin `disconnectedAt` (legacy); ejecutar el `TransactWriteCommand` de D2 (variante claim); mapear `TransactionCanceledException` a `error` (en inglés, como el resto de los mensajes del servidor; la web muestra su propio texto en español); broadcast si tiene éxito.
- [x] 4.2 `claim-moderation.spec.ts`: toma exitosa tras 60 s, rechazo antes de 60 s, rechazo con moderador conectado, toma con moderador legacy sin `disconnectedAt`, transacción cancelada (carrera), ronda y votos intactos.
- [x] 4.3 Rutear `claimModeration` en `handlers/default.ts` y `main.ts` (mismo ajuste que 3.3).
- [x] 4.4 `lib/moderation-change.integration.spec.ts` (nuevo, contra DynamoDB Local): dos tomas simultáneas → exactamente una tiene éxito; además cesión consistente, moderador que volvió, plazo no cumplido, registro legacy y destino inexistente. Verificado con `npx nx test-integration realtime-api` contra DynamoDB Local: 13/13.

## 5. Servidor: alinear `isModerator` al reingresar

- [x] 5.1 `apps/realtime-api/src/actions/join-room.ts`: derivar `isModerator` de `meta.moderatorName === request.name` en vez de copiarlo del ítem previo (riesgo de reingreso durante una toma, ver design).
- [x] 5.2 `join-room.spec.ts`: el moderador anterior que reingresa tras una cesión queda con `isModerator = false`; el moderador que recarga conserva `isModerator = true`.

## 6. Web: aviso temporal accesible

- [x] 6.1 `apps/web/src/app/ui/notice/`: componente con `role="status"` y `aria-live="polite"` siempre presente en el DOM, texto, botón de cerrar y cierre automático a los ~6 s.
- [x] 6.2 `notice.spec.ts`: muestra el texto, se cierra con el botón, se cierra solo tras el tiempo (fake timers), la región `aria-live` existe aunque no haya aviso.

## 7. Web: ceder y tomar desde la sala

- [x] 7.1 `apps/web/src/app/ui/participant-list/`: botón "Hacer moderador" por participante conectado no moderador (solo si `isModerator()` de quien mira) con output `transferModeration(name)`. **(ajuste)** "Tomar moderación" no va en la lista: la fila del moderador caído se dibuja con opacidad 0.5 y el botón quedaba apagado. Va en un aviso debajo de la lista, en `room.html` (ver design D8).
- [x] 7.2 `participant-list.spec.ts`: visibilidad de ambos botones según rol, conexión del destino y `canClaim`; emisión de los outputs.
- [x] 7.3 `apps/web/src/app/pages/room/room.ts`: `transferModeration(name)` y `claimModeration()` envían las acciones; tick de "ahora" mientras el moderador está desconectado y `computed` `canClaim` (D5).
- [x] 7.4 `room.ts`: detección de la transición `isModerator` `false → true` con `claimPending` (D6), mostrando el aviso "Ahora sos el moderador" solo en cesiones; mostrar los `error` del servidor recibidos tras ceder/tomar con el mismo componente de aviso.
- [x] 7.5 `room.spec.ts`: aviso al recibir una cesión, sin aviso al tomarla, sin aviso en la primera carga como moderador, `canClaim` antes y después de 60 s (fake timers), rechazo mostrado.
- [x] 7.6 **(pedido en la verificación manual)** `participant-list`: "Hacer moderador" pasa de botón con texto a una opción dentro de un menú ⋮ por participante (patrón de botón de menú accesible), y el moderador vigente se muestra en la primera fila. Spec actualizado con el escenario "El moderador encabeza la lista de participantes"; tests en `participant-list.spec.ts`.

## 8. Verificación

- [x] 8.1 `npx nx run-many -t lint test build` en los proyectos afectados.
- [x] 8.1b **(descubierta durante la verificación, previa a este change)** `package.json`: `dev:api` pasa a usar las credenciales `dummy` de `dev:db:create-table`. DynamoDB Local separa las tablas por access key + región; sin esto la API tomaba las credenciales reales de `~/.aws` y no encontraba la tabla (`ResourceNotFoundException`).
- [x] 8.2 Manual contra el stack local con dos o tres navegadores: ceder durante una votación, aviso al receptor, cortar el moderador y tomar tras 60 s, dos tomas casi simultáneas, el moderador anterior reingresa como participante común con `isVoter` encendido. Verificado por el usuario contra el stack local (2026-10-07).
