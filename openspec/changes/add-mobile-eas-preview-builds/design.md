## Context

`apps/mobile` (Expo/React Native, change `add-mobile-app`) hoy solo se prueba vía Expo Go apuntando a `ws://localhost:3001`, lo que exige entorno local + misma red Wi-Fi que quien desarrolla. `apps/realtime-api` ya está desplegado en AWS (`.github/workflows/deploy-backend.yml`, autenticado con OIDC) y en uso real por la web (`apps/web/src/environments/environment.aws.ts`). `apps/mobile/eas.json` (generado por `@nx/expo:application`, sin tocar hasta ahora) ya define un perfil `preview` (`distribution: internal`, `buildType: apk`) — justo el tipo de build que resuelve el problema, pero nada lo dispara ni lo conecta a un backend real todavía.

## Goals / Non-Goals

**Goals:**
- Que cualquiera con un Android pueda instalar la app tocando un link, sin Expo Go ni entorno local.
- Que esa app se conecte al backend de AWS ya desplegado (no a `localhost`).
- Que generar un build nuevo sea una acción simple y disparable por cualquiera con acceso al repo (no solo quien tiene la cuenta de Expo en su laptop).

**Non-Goals (explícitamente fuera de este change):**
- **iOS/Apple** — costo (USD 99/año) y fricción de cuenta quedan para un change futuro, si se decide.
- **Publicación en Play Store** — esto es distribución interna (link/QR de EAS), no un release público; publicar en la tienda es un salto adicional (ficha de la app, revisión, políticas) no cubierto acá.
- **EAS Update (OTA)** — no aplica todavía: recién sería relevante una vez que haya una app publicada de verdad a la que actualizar sin rebuild.
- **Notificación automática del build** (Slack u otro canal) — el link de instalación queda en el log del workflow de GitHub Actions; automatizar su distribución es una mejora futura, no necesaria para desbloquear al equipo.
- **Trigger automático en cada push** — deliberadamente manual (`workflow_dispatch`), ver Decisión 1.

## Decisions

### 1. Trigger manual (`workflow_dispatch`), no automático en push
A diferencia de `deploy-web.yml`/`deploy-backend.yml` (que sí corren en cada push a `master`), el build de mobile solo se dispara a mano desde la pestaña Actions.

**Por qué:** EAS Build en el tier gratuito de Expo tiene minutos de build limitados por mes. Un build de Android no es instantáneo (varios minutos); dispararlo en cada push agotaría la cuota rápido sin necesidad real — QA no necesita un build nuevo por cada commit, solo cuando hay algo concreto para probar.

### 2. Autenticación con `EXPO_TOKEN` (secret de GitHub), no OIDC
El backend usa OIDC hacia AWS (sin secrets de larga duración). EAS no ofrece un mecanismo equivalente de OIDC para GitHub Actions hoy — el mecanismo soportado es un access token personal/de robot (`EXPO_TOKEN`) generado una vez desde el dashboard de expo.dev y guardado como secret del repo, siguiendo el mismo patrón general (credenciales en secrets, nunca en código) pero con el mecanismo que la plataforma realmente ofrece.

### 3. Reusar el perfil `preview` existente de `eas.json`, sin crear uno nuevo
El generador de `@nx/expo:application` ya dejó `preview` configurado (`distribution: internal`, `android.buildType: apk`) — es exactamente lo que necesitamos. No hay razón para duplicar o crear un perfil paralelo.

### 4. `EXPO_PUBLIC_WS_URL` de producción vía `apps/mobile/.env.production`, committeado
Igual que `environment.aws.ts` en la web (también committeado, no es secreto — es solo la URL pública del WebSocket), en vez de usar el mecanismo de "Environment Variables" del dashboard de EAS. Expo carga `.env.production` automáticamente para builds que no son `developmentClient` (como `preview`), así que no hace falta configuración adicional en `eas.json` ni en el dashboard — el archivo en el repo es la única fuente de verdad, visible y versionada.

### 5. `eas init` es un paso manual único, no parte del pipeline
Vincular el proyecto a una cuenta/organización de EAS (generar el `projectId` en `app.json`) es una decisión de identidad que se hace una sola vez, a mano, por alguien con la cuenta de Expo del equipo — no tiene sentido automatizarlo ni tiene un buen mecanismo no-interactivo. Se documenta como parte del setup inicial, no como un step del workflow.

### 6. El workflow espera a que termine el build (sin `--no-wait`) y el link queda en el log
`eas build --non-interactive` (sin `--no-wait`) bloquea hasta que el build en la nube de Expo termina, e imprime el link de instalación al final. Eso alcanza para "instrucciones para el build": correr el workflow y leer el link en el log de esa corrida — sin necesitar un paso extra para publicar el resultado en otro lado.

## Risks / Trade-offs

- **[Riesgo] Se comparte el mismo backend de AWS que usa la web en producción** → los datos de prueba que genere QA con la app mobile (salas, participantes) se mezclan con datos reales, sin limpieza automática — mismo trade-off ya aceptado hoy por `npm run test:e2e:aws` (documentado en `docs/local-dev-workflow.md`). No se resuelve en este change; requeriría un stack de AWS separado ("staging") para aislarlo. Se documenta como limitación conocida.
- **[Riesgo] Primera vez del equipo con EAS** → el setup inicial (`eas init`, token) puede tener fricción no anticipada → Mitigación: probarlo una vez de punta a punta (generar un build real) antes de dar el change por terminado, y documentar cualquier paso adicional que aparezca.
- **[Trade-off] Cuota de build gratuita limitada** a cambio de trigger manual (no automático) → aceptado explícitamente, ver Decisión 1.
