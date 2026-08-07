# Builds de preview de la app mobile (EAS)

Guía para generar un `.apk` instalable de `apps/mobile` que cualquiera pueda instalar directo en un Android, sin Expo Go, sin entorno local, y sin depender de estar en la misma red que quien desarrolla. Pensado para que QA, el PO, o stakeholders remotos puedan probar la app sin ayuda técnica.

Ver el proceso de diseño completo en `openspec/changes/archive/*-add-mobile-eas-preview-builds/` (proposal, design, specs, tasks).

## Cómo funciona

- El build se genera en la nube de Expo (**EAS Build**), no en tu máquina ni en el runner de GitHub Actions — el workflow solo lo dispara y espera el resultado.
- El `.apk` generado usa el perfil de `apps/mobile/eas.json` elegido al disparar el workflow (`development`/`preview`/`production` — distribución interna por defecto: instalación directa vía link, sin pasar por Google Play).
- Se conecta al backend de `apps/realtime-api` del **ambiente elegido al disparar el workflow** (`dev`/`qa`/`prod` — ver `openspec/changes/add-multi-environment-deployment`), no a un backend local. La URL de cada ambiente vive en `apps/mobile/.env.<ambiente>`. Por eso funciona desde cualquier lugar con internet, sin estar en ninguna red particular. Perfil de empaquetado y ambiente son inputs independientes — se puede, por ejemplo, generar un apk `preview` apuntando a `dev` para debug puntual.
- **No cubre iOS** (fuera de alcance, ver `design.md`) ni publicación en tiendas — es solo para pruebas internas.

## Setup único (una sola vez, requiere la cuenta de Expo del equipo)

1. **Crear/usar una cuenta de Expo** en [expo.dev](https://expo.dev) (gratis para empezar).
2. **Vincular el proyecto a EAS** — desde `apps/mobile`, con la cuenta ya logueada localmente:
   ```bash
   npx eas-cli login
   npx eas-cli init
   ```
   Esto escribe un `projectId` en `apps/mobile/app.json` (se commitea, no es secreto).
3. **Generar un Access Token** para CI: en el dashboard de expo.dev, ir a *Account Settings → Access Tokens*, crear uno nuevo.
4. **Guardarlo como secret del repo en GitHub**: `Settings → Secrets and variables → Actions → New repository secret`, nombre `EXPO_TOKEN`, valor el token generado en el paso anterior.

Con esto hecho una vez, el pipeline queda funcionando para siempre (hasta que el token expire o se revoque).

## Disparar un build

**Opción A — desde GitHub Actions** (no requiere tener la cuenta de EAS logueada localmente; es la forma pensada para que cualquiera con acceso al repo lo dispare):

1. Ir a la pestaña **Actions** del repo en GitHub.
2. Seleccionar el workflow **"Build mobile (preview)"**.
3. Click en **"Run workflow"**, elegir el **perfil** (`development`/`preview`/`production`, empaquetado) y el **ambiente** (`dev`/`qa`/`prod`, a qué backend se conecta) — son independientes entre sí. Para el caso de uso típico de QA, `profile: preview` + `environment: qa`. El trigger sigue siendo manual — no se dispara solo en cada push, para no gastar los minutos de build gratuitos de EAS en builds que nadie pidió.
4. Esperar a que termine (varios minutos — el build corre en la nube de Expo).

**Opción B — desde tu laptop**, si tenés la cuenta de EAS logueada localmente (`npx eas-cli login`) y querés generar un build sin pasar por Actions (por ejemplo, para debuggear algo más rápido que esperando la cola de CI):

```bash
npm run build:mobile:preview
```

Corre lo mismo (`eas build --platform android --profile preview`) pero de forma interactiva desde tu terminal — el build en sí sigue corriendo en la nube de Expo, no en tu máquina. **Nota**: este script no tiene selección de ambiente (siempre usa el `.env` que esté activo localmente); para elegir el ambiente desde la laptop hay que copiar a mano el `.env.<ambiente>` deseado a `apps/mobile/.env.production.local` antes de correrlo. Para elegir el ambiente sin pasos manuales, usar la Opción A.

## Obtener el link de instalación

Al terminar, el log de esa corrida del workflow (el step "EAS Build") contiene el link de instalación directa del `.apk`. No hace falta entrar al dashboard de EAS ni ninguna herramienta adicional — se copia el link del log y se comparte (Slack, WhatsApp, lo que sea).

## Instalar en un Android

1. Abrir el link desde el celular (o escanear el QR que EAS también genera).
2. Android va a pedir permiso para instalar de "orígenes desconocidos" la primera vez (es esperado — no viene de Play Store).
3. Una vez instalada, la app funciona igual que cualquier app nativa: no depende de Expo Go, ni de que ninguna laptop esté prendida, ni de estar en ninguna red particular.

## Ya no comparte el backend de producción

Hasta `openspec/changes/add-multi-environment-deployment`, este build se conectaba siempre al mismo backend que la web en producción, mezclando datos de prueba de QA con uso real. Ahora, eligiendo `environment: qa` al disparar el workflow, las salas de prueba quedan en la tabla DynamoDB del stack `poker-planning-qa`, completamente separada de `prod`.

**Nota**: esto resuelve el caso de mobile. `npm run test:e2e:aws` sigue apuntando al único ambiente configurado para la web (`apps/web/src/environments/environment.aws.ts`, que en este change queda apuntando a `prod` — ver Impact de `add-multi-environment-deployment/proposal.md`) — la web no tiene ambientes múltiples todavía, así que ese trade-off (datos de e2e mezclados con producción) sigue vigente para ese caso puntual hasta que se aborde `web` en un change futuro.
