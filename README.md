# Planning Poker

Aplicación de Planning Poker en tiempo real para equipos: salas efímeras sin login, votación oculta con revelado simultáneo, promedio/moda calculados automáticamente, y resolución manual por el moderador. Disponible como app web y como app móvil nativa (Android/iOS), ambas conectadas al mismo backend en tiempo real.

Ver el proceso completo de diseño en `openspec/changes/archive/` (proposal, design, specs, tasks de cada change — el MVP original, el refactor que desacopló la lógica de cliente, y el agregado de la app mobile) y la documentación adicional en `docs/`.

## Stack

- **Frontend web**: Angular (`apps/web`), diseño atómico (`ui/`, `pages/`).
- **Frontend mobile**: Expo/React Native (`apps/mobile`), generado con `@nx/expo`.
- **Lógica de cliente compartida**: `packages/shared-contracts` (tipos, mazos, mensajes WebSocket) y `packages/room-client-runtime` (conexión WebSocket + estado de sala, agnóstico de framework) — consumidos tal cual por `apps/web` y `apps/mobile`, sin duplicación. Cada app solo aporta su propia capa de UI y una implementación mínima de persistencia de sesión (`sessionStorage` en web, en memoria en mobile).
- **Backend**: Lambdas Node/TypeScript (`apps/realtime-api`), WebSocket API Gateway.
- **Persistencia**: DynamoDB single-table con TTL.
- **Infraestructura**: AWS SAM (`infra/template.yaml`).
- **Monorepo**: Nx.

## Flujo de uso

1. **Crear sala**: en la pantalla inicial, ingresar tu nombre, elegir un mazo de estimación (Fibonacci, Powers of 2, T-Shirt Sizes) y decidir si vas a votar como moderador. Al crear la sala, quedás como su único moderador y se genera un código de sala.
2. **Compartir el link**: la sala muestra un link (`/room/<código>`) que se comparte con el resto del equipo.
3. **Unirse**: cada participante entra con el link o el código de sala + su nombre. No requiere cuenta ni contraseña.
4. **Votar**: el moderador define el título de la historia actual; cada participante vota en secreto eligiendo una carta del mazo. Los demás solo ven "ya votó", sin el valor.
5. **Revelar**: el moderador revela los votos cuando quiera. Se muestran todos los votos, el promedio y la moda.
6. **Resolver la historia**: el moderador acepta el promedio, la moda, o ingresa un valor manual como puntuación definitiva. También puede iniciar una nueva ronda (descartando los votos) o definir la próxima historia.
7. **Reconexión**: si alguien pierde la conexión o recarga la página estando en una sala, se reconecta automáticamente sin perder su voto (identificado por nombre + sala).
8. **Cerrar sala**: el moderador puede cerrar la sala en cualquier momento; todos ven un resumen final con la lista de historias estimadas y el puntaje total.

## Deuda técnica conocida

- **Identidad de reconexión por nombre + sala**: un participante se identifica únicamente por su nombre dentro de la sala, no por un token de sesión. Si dos personas intentan usar el mismo nombre en la misma sala mientras una está conectada, la segunda es rechazada. Esto es una limitación aceptada para el MVP — la evolución natural sería generar un token de sesión persistido en el navegador (`localStorage`) al unirse, para desambiguar identidad sin depender del nombre. Ver `openspec/changes/archive/2026-07-05-planning-poker-mvp/design.md` (Decisión 3) para el detalle completo.
- **Sin historial entre sesiones**: las salas son efímeras (TTL en DynamoDB); no hay cuentas de usuario ni comparación de velocity entre sprints.
- Ver también [docs/known-issues.md](docs/known-issues.md) (incompatibilidad de versiones en el test runner de componentes Angular) y [docs/future-ideas.md](docs/future-ideas.md) (ideas para futuras iteraciones, aún no implementadas).

## Desarrollo local

Ver la guía paso a paso completa en [docs/local-dev-workflow.md](docs/local-dev-workflow.md). Resumen rápido:

```bash
npm install

# 1. Levantar DynamoDB Local (Docker) y crear la tabla (solo la primera vez)
npm run dev:db:up
npm run dev:db:create-table

# 2. Backend: servidor WebSocket local (emula API Gateway + Lambdas)
npm run dev:api

# 3. Frontend web: Angular dev server
npm start
```

Abrir `http://localhost:4200`.

Para la app mobile (Expo, requiere el backend de los pasos 1-2 arriba y la app **Expo Go** en tu celular): `npm run start:mobile`, escanear el QR. Ver la sección "Probar la app mobile (Expo)" de [docs/local-dev-workflow.md](docs/local-dev-workflow.md) para el detalle (configuración de red, troubleshooting de firewall, compatibilidad de SDK con Expo Go).

**Para compartir la app mobile con QA/PO/stakeholders remotos** (sin que necesiten correr nada localmente ni estar en tu red): un build instalable (`.apk`) generado bajo demanda desde GitHub Actions, conectado al backend ya desplegado en AWS. Ver [docs/mobile-preview-builds.md](docs/mobile-preview-builds.md) para el setup y cómo disparar un build.

## Despliegue a AWS

El backend se despliega automáticamente a AWS en cada push a `master` vía GitHub Actions (`.github/workflows/deploy-backend.yml`), autenticado con OIDC — ver [docs/aws-oidc-setup.md](docs/aws-oidc-setup.md) para el setup de credenciales (paso único) y la explicación del mecanismo. Para el flujo manual (fallback, o desplegar a un stack distinto), ver la guía completa en [docs/aws-deployment.md](docs/aws-deployment.md) (incluye cómo desplegar, verificar, actualizar, y eliminar el stack).

```bash
cd infra
sam build
sam deploy
```

## Comandos útiles

```bash
npm start             # Angular dev server (apunta a ws://localhost:3001 por defecto)
npm run start:api     # apps/realtime-api vía Nx (no usado en el día a día, ver dev:api)
npm run start:mobile  # Expo CLI para apps/mobile (muestra QR para Expo Go)
npm run build         # Build de producción del frontend web
npm run build:api     # Build de producción del backend
npm test              # Corre los tests de todos los proyectos
npm run lint          # Lint de todos los proyectos
```

## Estructura del repo

```
apps/
  web/                    Frontend Angular
  mobile/                 Frontend Expo/React Native (Android/iOS)
  realtime-api/           Lambdas (WebSocket API) + servidor de desarrollo local
packages/
  shared-contracts/       Tipos compartidos: modelos de dominio, mazos, mensajes WebSocket —
                          consumido por apps/web, apps/mobile y apps/realtime-api
  room-client-runtime/    Conexión WebSocket + estado de sala, agnóstico de framework —
                          consumido por apps/web y apps/mobile (cada uno aporta su propia
                          UI y su propia persistencia de sesión)
infra/
  template.yaml           Infraestructura AWS SAM (DynamoDB, WebSocket API Gateway, Lambdas)
openspec/
  changes/archive/        Changes ya implementados: proposal, design, specs, tasks de cada uno
                          (MVP original, extracción de room-client-runtime, agregado de mobile)
  specs/                  Specs vigentes por capability (fuente de verdad del comportamiento actual)
docs/
  local-dev-workflow.md         Cómo levantar y probar el entorno local paso a paso (web y mobile)
  mobile-preview-builds.md      Cómo generar y distribuir un build instalable de mobile (EAS) a QA/stakeholders remotos
  aws-deployment.md             Cómo desplegar, verificar y eliminar el stack de AWS (flujo manual)
  aws-oidc-setup.md             Setup único de OIDC para que GitHub Actions despliegue el backend automáticamente
  sam-local-dynamodb-local.md   Notas de debugging de SAM local + DynamoDB Local
  known-issues.md               Problemas conocidos
  future-ideas.md               Backlog de ideas para futuras iteraciones
```
