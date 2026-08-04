## Why

Hoy Planning Poker solo existe como app web (`apps/web`, Angular). El equipo quiere una app móvil nativa con la misma funcionalidad (crear sala, unirse, votar, revelar, resolver historias, moderación), para cubrir el caso de uso de participar desde el celular. El refactor previo (`uncouple-client-logic`) dejó preparada justo esta necesidad: `packages/shared-contracts` (tipos) y `packages/room-client-runtime` (conexión WebSocket + estado de sala) son agnósticos de framework y no dependen de ninguna API exclusiva del navegador, así que la app móvil puede consumirlos sin modificarlos. El backend (`apps/realtime-api`) ya es agnóstico del cliente. La app móvil se construye siguiendo los generadores oficiales de Nx (`@nx/expo`), no un plugin de terceros.

## What Changes

- Nueva app `apps/mobile` generada con `@nx/expo:application` (React Native vía Expo, managed workflow).
- La app implementa paridad funcional con la web: crear sala, unirse a sala, votación oculta, revelado, resolución de historia (aceptar promedio/moda o sobreescribir), controles de moderador, resumen de sesión — sin reusar código de UI de `apps/web` (Angular y React Native no comparten capa visual), pero sí toda la lógica no visual.
- Reusa `packages/shared-contracts` y `packages/room-client-runtime` sin modificarlos.
- Implementa un `SessionStore` propio de mobile (en memoria, se pierde al cerrar la app — análogo más simple al comportamiento "por pestaña" que tiene hoy `sessionStorage` en la web). Documentado como punto de partida reversible, no una decisión definitiva.
- El `WebSocketFactory` por defecto de `room-client-runtime` (usa el `WebSocket` global) se reusa sin cambios — React Native provee un `WebSocket` global compatible.
- **Sin cambios en `apps/realtime-api`** ni en el protocolo de mensajes.
- **Sin cambios en `apps/web`** ni en los specs existentes de sus capabilities (`room-management`, `estimation-session`, `session-summary`, `participant-identity`) — quedan como están, documentando específicamente el comportamiento web (ver decisión en `design.md`).
- Nueva dependencia de workspace: `@nx/expo` (y transitivamente `@nx/react-native`).

## Capabilities

### New Capabilities
- `mobile-app`: app móvil nativa (iOS/Android vía Expo) que ofrece la misma funcionalidad que las capabilities `room-management`, `estimation-session`, `session-summary` y `participant-identity` ya documentadas para la web, para un cliente nativo. No reemplaza ni redefine esas capabilities — es un cliente adicional que las satisface a su manera.

### Modified Capabilities
(ninguna — decisión explícita: los specs existentes de la web no se tocan en este change; ver `design.md` para el razonamiento)

## Impact

- **Código nuevo**: `apps/mobile` (app Expo/React Native).
- **Dependencias nuevas del workspace**: `@nx/expo`, `@nx/react-native` (generador oficial de Nx para apps móviles).
- **No afectado**: `apps/realtime-api`, `apps/web`, `packages/shared-contracts`, `packages/room-client-runtime` (consumidos, no modificados), specs existentes en `openspec/specs/`.
- **Riesgo**: ninguno de los dos mantenedores conoce Expo/React Native hoy — primera app del equipo en ese stack; esperable curva de aprendizaje durante la implementación.
