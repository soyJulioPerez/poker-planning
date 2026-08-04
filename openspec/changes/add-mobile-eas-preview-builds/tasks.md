## 1. Setup único de EAS (manual, requiere la cuenta de Expo del equipo)

- [x] 1.1 Crear/usar una cuenta de Expo (expo.dev) para el equipo — cuenta `kaizen-devs-team`
- [x] 1.2 Desde `apps/mobile`, correr `eas login` + `eas init` — vincula el proyecto a EAS y escribe un `projectId` en `app.json` — confirmado: `extra.eas.projectId` y `owner: "kaizen-devs-team"` en `apps/mobile/app.json`, `slug` actualizado a `poker-planning`
- [x] 1.3 Generar un Access Token desde el dashboard de expo.dev y guardarlo como secret `EXPO_TOKEN` en la configuración del repo de GitHub — token de robot user `github-actions-ci` (rol Developer), guardado como `EXPO_TOKEN`

## 2. Configuración de la app

- [x] 2.1 Crear `apps/mobile/.env.production` con `EXPO_PUBLIC_WS_URL` apuntando al mismo endpoint de AWS que usa `apps/web/src/environments/environment.aws.ts` — `wss://imzlnpyshh.execute-api.us-east-2.amazonaws.com/dev`
- [x] 2.2 Confirmar que `apps/mobile/eas.json` (perfil `preview`) no necesita cambios — reusar tal cual (ver `design.md`, Decisión 3) — confirmado: `distribution: internal`, `android.buildType: apk`, ya está bien

## 3. Pipeline

- [x] 3.1 Crear `.github/workflows/build-mobile.yml`: trigger `workflow_dispatch` únicamente (sin trigger de `push`), checkout, setup Node, `npm ci`
- [x] 3.2 Agregar el step de EAS Build (`eas build --platform android --profile preview --non-interactive`, autenticado con el secret `EXPO_TOKEN`), sin `--no-wait` para que el link de instalación quede en el log de la corrida — se usa la action oficial `expo/expo-github-action@v8` para instalar `eas-cli` y autenticar con el token, sin necesidad de manejarlo a mano
- [x] 3.3 Agregar script `npm run build:mobile:preview` (agregado durante la implementación, no estaba en el diseño original) — alternativa local a Actions para quien tenga la cuenta de EAS logueada en su laptop, mismo perfil `preview`, útil para debuggear sin esperar la cola de CI

## 4. Documentación

- [x] 4.1 Documentar el flujo completo en `docs/` (setup único de la sección 1, cómo disparar un build desde Actions, cómo encontrar el link de instalación en el log, cómo instalarlo en un Android) — `docs/mobile-preview-builds.md`
- [x] 4.2 Actualizar `README.md` para mencionar el build de preview como forma de distribuir la app a QA/stakeholders remotos, junto a `npm run start:mobile`

## 5. Verificación

- [x] 5.1 Correr `npm run build:mobile:preview` localmente (con el código actual, antes de commitear/pushear) y confirmar que el build termina exitosamente — **dos intentos fallaron** (ver notas de fricción abajo, fases "Install dependencies" y "Bundle JavaScript"); ambos corregidos y revalidados de forma aislada localmente sin gastar builds reales de EAS. Falta correr el `eas build` completo una vez más para confirmar de punta a punta (ver 5.2).
- [x] 5.2 Commitear y pushear los cambios de este change; disparar un build real de punta a punta (Actions o `npm run build:mobile:preview`) y confirmar que termina exitosamente — build exitoso vía `npm run build:mobile:preview`, `.apk` generado y link de instalación entregado
- [x] 5.3 Instalar el `.apk` resultante en un dispositivo Android que no esté en la misma red que ningún desarrollador (ej. usando datos móviles) y confirmar que crea/une salas contra el backend de AWS — confirmado por el usuario: instalado y probado con datos móviles (fuera de la red Wi-Fi), creó sala, definió historia de usuario, votó y reveló la puntuación — flujo completo contra el backend de AWS funcionando
- [x] 5.4 Documentar cualquier fricción o paso adicional encontrado durante el setup real, no anticipado en `design.md`

### Fricción encontrada: `apps/mobile/package.json` no puede declarar paquetes internos de Nx

El primer build real (disparado con `npm run build:mobile:preview`) falló en la fase "Install dependencies" con `npm error 404 Not Found - GET https://registry.npmjs.org/room-client-runtime`. Causa: `apps/mobile/package.json` declaraba `"room-client-runtime": "0.0.1"` y `"shared-contracts": "0.0.1"` como si fueran paquetes reales de npm (arrastrado del change `add-mobile-app`, tarea 1.4 — una decisión que resultó estar mal fundada). EAS Build corre `npm ci` **aislado dentro de `apps/mobile`**, sin acceso al `node_modules` de la raíz del monorepo, y esos dos paquetes nunca estuvieron publicados en el registry real.

**Por qué esas dos líneas nunca hicieron falta**: `apps/mobile/src/app/core/*` importa `shared-contracts`/`room-client-runtime` vía los path aliases de `tsconfig.base.json`. Metro los resuelve directamente a los archivos fuente gracias a `withNxMetro` (`apps/mobile/metro.config.js`) — nunca pasa por resolución de `node_modules` para esos dos paquetes. `nx export mobile` ya lo confirmaba desde el principio, sin que nadie lo notara.

**Fix aplicado**:
- Se quitaron esas dos líneas de `apps/mobile/package.json`.
- El resto de las dependencias (`react`, `react-native`, `expo`, etc.) se fijaron a las mismas versiones exactas que la raíz (antes eran `"*"`) — necesario porque `npm ci` aislado en `apps/mobile` resuelve `"*"` contra el registry en ese momento, pudiendo traer versiones más nuevas que rompan la compatibilidad con el SDK de Expo Go (mismo problema que ya se resolvió una vez con el downgrade a SDK 54).
- Se agregaron `react-dom` y `react-test-renderer` explícitos (peer dependencies reales de `react-native-web`/`@testing-library/react-native` que no estaban declaradas, y que un `npm ci` aislado necesita resolver por su cuenta).
- Se regeneró `apps/mobile/package-lock.json` (el commiteado anteriormente tenía las referencias rotas horneadas adentro) y se commitea intencionalmente esta vez — es necesario para que `npm ci` funcione, tanto en EAS Build como localmente.
- **Nota para desarrollo local**: `apps/mobile/node_modules` (generado por el `npm ci` de validación) rompe `nx test mobile` si se lo deja puesto — Jest resuelve `react-native` desde ahí en vez de la raíz, y el patrón de transform de Babel no lo reconoce en esa ubicación. Se borró después de validar. Si hace falta volver a generarlo (para simular el install de EAS localmente), borrarlo de nuevo antes de correr tests.

### Fricción encontrada: `apps/mobile/metro.config.js` requiere `@nx/expo`, no declarado

Con el fix anterior aplicado, el siguiente intento falló en la fase **"Bundle JavaScript"**: `Error: Cannot find module '@nx/expo'`, en el `require('@nx/expo')` de `apps/mobile/metro.config.js` (usado para `withNxMetro`). Mismo patrón que la fricción anterior: `@nx/expo` solo estaba declarado como devDependency de la raíz, nunca en `apps/mobile/package.json` — en el entorno aislado de EAS Build, ese `require` no lo encuentra.

**Fix aplicado**:
- Se agregó `"@nx/expo": "23.0.1"` (misma versión exacta que la raíz) a `apps/mobile/package.json`. `@nx/devkit` (también requerido por `withNxMetro`) viene como dependencia transitiva de `@nx/expo`, no hizo falta declararlo aparte.
- De paso, `expo doctor` (que corre como parte del build) marcó una advertencia relacionada: `@expo/metro-config` no debería instalarse/importarse directo, sino usar `expo/metro-config` (sub-export del paquete `expo`). Se corrigió `apps/mobile/metro.config.js` para importar desde ahí, y se sacó `@expo/metro-config` de `apps/mobile/package.json` y de la raíz (ya no lo necesita nadie directamente).
- Validado localmente: dentro de `apps/mobile` con su propio `node_modules` aislado (simulando el entorno de EAS), `require('@nx/expo')` y `require('@nx/devkit')` resuelven correctamente, y `workspaceRoot` encuentra la raíz real del monorepo.

### Fricción encontrada: `babel-preset-expo` no declarado, y falta una herramienta sistemática (no whack-a-mole)

Con los dos fixes anteriores aplicados, el siguiente intento falló de nuevo en "Bundle JavaScript": `Error: Cannot find module 'babel-preset-expo'` (referenciado desde `apps/mobile/.babelrc.js`, mismo patrón — solo declarado en la raíz). Se agregó a `apps/mobile/package.json`.

En este punto, corregir un `require` faltante a la vez (encontrado solo cuando el build real fallaba) era insostenible — cada vuelta cuesta un build real de EAS y varios mensajes de ida y vuelta. Se buscó, y existe, una herramienta sistemática ya integrada en Nx: la regla de ESLint **`@nx/dependency-checks`** (la misma que ya usan `packages/shared-contracts` y `packages/room-client-runtime`), que compara los imports/requires reales del proyecto contra lo declarado en `package.json` y reporta faltantes y sobrantes.

**Se activó para `apps/mobile`** (`eslint.config.mjs`, no estaba configurada por el generador de `@nx/expo:application`, a diferencia de `@nx/js:library`). Encontró un hallazgo real que se nos había pasado: **`rxjs`**, usado directo en `apps/mobile/src/app/core/use-observable.ts`, que hubiera sido el próximo fallo de build. Se agregó.

**Limitación descubierta de la regla**: su análisis estático solo mira imports en `src/**`, no los `require()` de archivos de configuración (`.babelrc.js`, `metro.config.js`) ni los plugins declarados por nombre en `app.json` (`expo-splash-screen`). Por eso marca como "no usados" varios paquetes que en realidad sí hacen falta (confirmado empíricamente con los fallos reales de este mismo change): `babel-preset-expo`, `expo-splash-screen`, `expo-status-bar`, `expo-system-ui`, `metro-resolver`, `react-dom`, `react-native-screens`, `react-native-svg`, `react-native-web`, `react-test-renderer`. Se documentaron como `ignoredDependencies` con comentarios explicando el motivo de cada grupo, en vez de eliminarlos (eliminar sin volver a probar hubiera sido arriesgado). También se agregó `ignoredFiles` para el propio `eslint.config.mjs` (mismo patrón que ya usan `shared-contracts`/`room-client-runtime`, se me había pasado copiarlo la primera vez).

**Resultado**: `nx lint mobile` ahora es una señal confiable para detectar este tipo de problema *antes* de gastar un build real, en vez de descubrirlo build a build.

**Nota sobre la simulación local**: se intentó reproducir el entorno aislado de EAS Build de forma completa (ocultando temporalmente el `node_modules` de la raíz + corriendo el comando real de bundle) para detectar más problemas sin gastar builds. Encontró que `withNxMetro` necesita `<raíz>/node_modules` presente (lo crea el script `eas-build-post-install.mjs` vía symlink en el Linux real de EAS). En Windows, symlinks reales requieren admin; se probó con una *junction* como alternativa, pero Metro (`metro-file-map`) no maneja bien las junctions de Windows en su rastreo de archivos — error distinto, no reproducible en el Linux real de EAS. Se abandonó esa vía de simulación en este punto (retornos decrecientes) y se limpiaron todos los artefactos temporales. **Incidente durante la limpieza**: una combinación de `rmdir`/`mv` con la junction de por medio terminó borrando el `node_modules` real de la raíz — recuperado sin pérdida de datos con `npm ci` desde el `package-lock.json` (intacto).
