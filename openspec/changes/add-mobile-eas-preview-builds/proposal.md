## Why

Hoy la única forma de probar `apps/mobile` es vía Expo Go apuntando al backend local (`ws://localhost:3001`) de la laptop de quien desarrolla — esto exige que QA, el PO, o stakeholders sepan levantar el entorno local y estén en la misma red Wi-Fi que esa laptop. Para un equipo remoto (parcial o totalmente), eso es una barrera real: no todos tienen el conocimiento técnico ni la posibilidad de correr el proyecto localmente, y "estar en la misma red" no escala más allá de estar todos en la misma oficina al mismo tiempo. Se necesita una forma de instalar la app directamente (sin Expo Go, sin depender de una laptop prendida) y que se conecte a un backend accesible desde cualquier lugar con internet — lo cual ya existe: `apps/realtime-api` está desplegado en AWS y en uso por la web (`environment.aws.ts`).

## What Changes

- Nuevo archivo `apps/mobile/.env.production` con `EXPO_PUBLIC_WS_URL` apuntando al backend ya desplegado en AWS (mismo endpoint que usa `apps/web` vía `environment.aws.ts`), análogo al patrón que ya existe para la web. Expo lo carga automáticamente en builds que no son `developmentClient` (los perfiles `preview`/`production` de `eas.json`), sin afectar `.env`/`.env.local` (desarrollo local).
- Setup único (manual, documentado, no automatizable): cuenta de Expo, `eas init` desde `apps/mobile` (vincula el proyecto a EAS y escribe un `projectId` en `app.json`), generación de un `EXPO_TOKEN` guardado como secret de GitHub.
- Nuevo workflow de GitHub Actions (`.github/workflows/build-mobile.yml`), disparado manualmente (`workflow_dispatch`, mismo patrón que el redeploy manual de `deploy-backend.yml`), que corre `eas build --platform android --profile preview --non-interactive` usando el perfil `preview` ya existente en `apps/mobile/eas.json` (distribución interna, `.apk`).
- Documentación del flujo completo (setup único + cómo disparar un build + cómo instalarlo) en `docs/`.
- **Fuera de alcance explícito**: iOS/Apple (queda para un change futuro), publicación en Play Store (esto es distribución interna vía link/QR de EAS, no un release público), y notificación automática del build a Slack/similar (mejora futura).

## Capabilities

### New Capabilities
- `mobile-preview-builds`: generación bajo demanda de builds Android instalables directamente (`.apk`, distribución interna vía EAS) que se conectan al backend ya desplegado en AWS, sin depender de un entorno de desarrollo local ni de estar en la misma red que quien desarrolla.

### Modified Capabilities
(ninguna — no cambia el comportamiento de la app en sí, solo cómo se construye/distribuye para pruebas)

## Impact

- **Código nuevo**: `apps/mobile/.env.production`, `.github/workflows/build-mobile.yml`.
- **Config nueva (no código)**: `projectId` de EAS en `apps/mobile/app.json` (generado por `eas init`), secret `EXPO_TOKEN` en GitHub.
- **No afectado**: `apps/realtime-api` (se reusa el backend de AWS ya desplegado, sin cambios), `apps/web`, `packages/shared-contracts`, `packages/room-client-runtime`, specs existentes de `mobile-app`.
- **Dependencia externa nueva**: cuenta de Expo (tier gratuito) para EAS Build — tiene límite de minutos de build por mes; el trigger manual (no automático en cada push) es deliberado para no agotarlo.
- **Riesgo**: nadie del equipo tiene experiencia previa con EAS — primera vez configurando este flujo.
