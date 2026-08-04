## Context

`apps/web` (Angular) es hoy el único cliente de `apps/realtime-api`. El refactor `uncouple-client-logic` (archivado) extrajo la lógica de conexión/estado a `packages/room-client-runtime`, agnóstica de framework, con dos puntos de extensión ya pensados para esto: `SessionStore` (inyectable) y el `WebSocketFactory` (con default basado en el `WebSocket` global, reemplazable). `packages/shared-contracts` aporta los tipos y catálogos (`AVAILABLE_DECKS`, `AVAILABLE_ICON_GROUPS`) sin ninguna dependencia de UI.

El equipo no tiene experiencia previa con Expo/React Native — es la primera app de este stack en el repo.

## Goals / Non-Goals

**Goals:**
- Scaffoldear `apps/mobile` con el generador oficial `@nx/expo:application`.
- Paridad funcional con la web: crear sala, unirse por código, votar, revelar, resolver historia, controles de moderador, resumen de sesión.
- Reusar `shared-contracts` y `room-client-runtime` sin modificarlos.

**Non-Goals (explícitamente fuera de este change):**
- **Deep links / Universal Links** (abrir la app tocando un link de sala compartido) — requiere verificación de dominio (`apple-app-site-association`, `assetlinks.json`) y presencia en tiendas; unirse por código cubre el mismo caso de uso con mucho menos costo inicial. Queda como mejora futura.
- **Notificaciones push.**
- **Publicación en App Store / Play Store** — este change entrega una app funcional corriendo vía Expo Go / development build, no un release público.
- **Tests e2e automatizados de mobile** (Detox/Maestro) — mismo patrón que tuvo la web: el MVP (`planning-poker-mvp`) no incluyó e2e, se agregó después en un change separado (`add-e2e-playwright-tests`). Se valida manualmente en este change.
- **Reescribir los specs existentes** de `room-management`/`estimation-session`/`session-summary`/`participant-identity` — quedan tal cual, documentando el comportamiento web (decisión ya tomada en `proposal.md`).

## Decisions

### 1. `apps/mobile`, generado con `@nx/expo:application`
Sigue la convención de nombres corta ya usada (`apps/web`, no `apps/web-app`). Se agrega `@nx/expo` (y transitivamente `@nx/react-native`) como dependencia del workspace — son los únicos generadores de app móvil que ofrece Nx oficialmente hoy (ver exploración previa: no hay plugin oficial de Ionic en esta versión de Nx).

### 2. Navegación: dos pantallas top-level (Home, Room), sin Expo Router salvo que el generador lo traiga por defecto
Análogo a `pages/home` y `pages/room` de la web. Se usa lo que `@nx/expo:application` scaffoldee por defecto para navegación entre pantallas (a confirmar durante la implementación); si no incluye nada, se agrega React Navigation (estándar de facto del ecosistema). Se evita introducir Expo Router como pieza adicional a aprender salvo que venga ya integrado — es la primera app del equipo en este stack, minimizar conceptos nuevos es una prioridad explícita.

### 3. Unión a sala por código, no por deep link
Consecuencia directa del Non-Goal de deep links. El flujo "Unirse a sala" pide el código/ID de sala como input manual (igual que hoy hace la tab "Unirse a sala" de la web, sin la parte de abrir un link directo).

### 4. `SessionStore` de mobile: implementación en memoria
Vive en `apps/mobile`, implementa la interfaz `SessionStore` de `room-client-runtime`. Se pierde al cerrar la app — análogo más simple al comportamiento "por pestaña" de `sessionStorage` en la web. Decisión reversible y de bajo costo (ver conversación de exploración): si en la práctica se necesita persistencia entre aperturas de la app, se reemplaza por una implementación basada en `AsyncStorage`/`expo-secure-store` sin tocar `room-client-runtime`.

### 5. `WebSocketFactory`: se reusa el default de `room-client-runtime` sin cambios
React Native provee un `WebSocket` global compatible con la API del navegador, así que el `defaultWebSocketFactory` (`new WebSocket(url)`) funciona sin necesidad de una implementación mobile-specific.

### 6. Config de conexión vía variables de entorno públicas de Expo
`EXPO_PUBLIC_WS_URL` (convención estándar de Expo SDK moderno: variables con prefijo `EXPO_PUBLIC_` se inlinean en build), análogo a `environment.wsUrl` en la web. Se lee al construir el `RoomClientConfig` pasado a `RoomClient`.

### 7. Catálogos de mazos/íconos: se reusan tal cual
`AVAILABLE_DECKS` y `AVAILABLE_ICON_GROUPS` de `shared-contracts` se consumen directamente; solo se reescribe la presentación visual (selección de mazo, icon picker) en componentes nativos.

## Risks / Trade-offs

- **[Riesgo] Curva de aprendizaje de Expo/React Native** (primera app del equipo en este stack) → Mitigación: `tasks.md` empieza por scaffold + una pantalla mínima end-to-end (crear sala y ver el room state) antes de portar el resto de la funcionalidad, para validar el flujo completo temprano.
- **[Riesgo] Sin cobertura e2e automatizada de mobile** → Mitigación: verificación manual explícita en `tasks.md` (crear sala, unirse desde un segundo dispositivo/simulador, votar, revelar, resolver, reconexión); e2e automatizado queda como change futuro, igual que pasó históricamente con la web.
- **[Trade-off] Sin deep links** a cambio de evitar la complejidad de verificación de dominio → aceptado explícitamente; unirse por código es un flujo completo, solo menos fluido que tocar un link.
