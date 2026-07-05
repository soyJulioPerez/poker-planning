# Cómo levantar el entorno de desarrollo local y probar manualmente

Guía paso a paso para correr la app completa (frontend Angular + backend WebSocket + DynamoDB) en tu máquina, sin desplegar nada a AWS. Pensada para poder hacer pruebas manuales en el navegador.

## Por qué existe esto

`sam local invoke` (ver [sam-local-dynamodb-local.md](sam-local-dynamodb-local.md)) sirve para probar una Lambda puntual con un evento de ejemplo, pero no emula bien una WebSocket API completa (conexiones persistentes, broadcast a otros clientes). Para poder abrir el navegador y jugar con la app de verdad, se usa en cambio:

- Un **servidor WebSocket real** (`apps/realtime-api/src/dev-server.ts`, con la librería `ws`) que expone las mismas acciones (`createRoom`, `joinRoom`, etc.) que usan las Lambdas, ejecutando exactamente la misma lógica de negocio (`handleCreateRoom`, `handleJoinRoom`, ...).
- **DynamoDB Local** en Docker, igual que en el flujo de `sam local invoke`.
- El **dev server de Angular** normal (`nx serve web`).

## Requisitos

- Docker corriendo (`docker ps` no debe dar error).
- Dependencias instaladas (`npm install` en la raíz del repo).

## Paso a paso

### 1. Levantar DynamoDB Local

```bash
npm run dev:db:up
```

Esto corre `docker run -d --name dynamodb-local -p 8000:8000 amazon/dynamodb-local:latest`. Si el contenedor ya existe (de una sesión anterior), en vez de esto usar:

```bash
docker start dynamodb-local
```

### 2. Crear la tabla (solo la primera vez, o si el contenedor se recreó)

```bash
npm run dev:db:create-table
```

Internamente corre `aws dynamodb create-table ... --endpoint-url http://localhost:8000 --region us-east-2`.

**Importante**: la región usada (`us-east-2` en los scripts) debe coincidir con la que devuelve `aws configure get region` en tu máquina — ver la explicación completa de por qué en [sam-local-dynamodb-local.md](sam-local-dynamodb-local.md). Si tu perfil AWS usa otra región, edita `dev:db:create-table` y la variable `AWS_REGION` de `dev:api` en `package.json` para que coincidan.

Si el contenedor de DynamoDB Local se reinicia (`docker stop` / `docker start` de una sesión vieja, o se borra y se vuelve a crear), los datos en memoria se pierden y hay que volver a correr este comando (dará `ResourceInUseException` si la tabla ya existe, lo cual es la señal de que no hace falta recrearla).

### 3. Levantar el servidor WebSocket local (backend)

```bash
npm run dev:api
```

Esto arranca `apps/realtime-api/src/dev-server.ts` con `tsx watch` (recarga automática al guardar cambios), escuchando en `ws://localhost:3001`, apuntando a la tabla `poker-planning-rooms` en DynamoDB Local.

Deberías ver:
```
Local WebSocket dev server listening on ws://localhost:3001
```

### 4. Levantar el frontend Angular

En otra terminal:

```bash
npm start
```

Levanta el dev server de Angular en `http://localhost:4200`. El frontend está configurado para conectarse a `ws://localhost:3001` (ver `apps/web/src/app/core/room-socket.service.ts`).

### 5. Probar manualmente en el navegador

1. Abrir `http://localhost:4200`.
2. Pestaña "Crear sala": poner un nombre, elegir mazo, crear sala. Deberías navegar automáticamente a `/room/<CODIGO>` y ver el código de sala para compartir.
3. Abrir una **segunda pestaña** (o ventana en incógnito) en `http://localhost:4200`.
4. Pestaña "Unirse a sala": pegar el código de la sala creada, poner otro nombre, unirse.
5. Verificar que ambas pestañas muestran la lista de participantes actualizada en vivo (sin recargar la página).

### 6. Apagar todo al terminar

```bash
docker stop dynamodb-local
```

Y cerrar (Ctrl+C) los procesos de `npm run dev:api` y `npm start`.

## Verificar sin abrir el navegador manualmente (con Playwright)

Si se quiere automatizar la verificación en vez de hacerla a mano, se puede usar Playwright (ya instalado como dependencia del proyecto vía `@playwright/test`, parte del preset de Nx).

### Instalar el navegador (solo la primera vez)

```bash
npx playwright install chromium
```

### Ejemplo de script de verificación puntual

Crear un archivo temporal en la raíz del proyecto (tiene que estar dentro del repo para que `node` resuelva `@playwright/test` desde `node_modules`; no funciona si se ejecuta desde una carpeta fuera del proyecto):

```js
// pw-check.mjs
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const modPage = await browser.newPage();
const partPage = await browser.newPage();

await modPage.goto('http://localhost:4200');
await modPage.getByLabel('Tu nombre').fill('Ana');
await modPage.getByRole('button', { name: 'Crear sala' }).last().click();
await modPage.waitForURL(/\/room\//, { timeout: 5000 });
const roomId = modPage.url().split('/room/')[1];
console.log('Room created:', roomId);

await partPage.goto('http://localhost:4200');
await partPage.getByRole('button', { name: 'Unirse a sala' }).first().click();
await partPage.getByLabel('Código de sala').fill(roomId);
await partPage.getByLabel('Tu nombre').fill('Bruno');
await partPage.getByRole('button', { name: 'Unirse', exact: true }).click();
await partPage.waitForURL(/\/room\//, { timeout: 5000 });

await modPage.waitForSelector('text=Bruno', { timeout: 5000 });
console.log('Moderador ve a Bruno en la lista: OK');

await browser.close();
```

Correrlo con (requiere que `dev:api` y `npm start` ya estén corriendo):

```bash
node pw-check.mjs
```

Borrar el archivo (`pw-check.mjs`) al terminar — es un script de prueba puntual, no parte de la suite de tests del proyecto.

### Nota sobre selectores ambiguos

Si un texto de botón aparece más de una vez en la página (por ejemplo el tab "Unirse a sala" y el botón de submit "Unirse"), Playwright falla en "strict mode" con un error `resolved to 2 elements`. Solución: usar `{ exact: true }` o acotar con `.first()`/`.last()` para desambiguar.

## Problema conocido: tests unitarios de Angular rotos

Los pasos de arriba no dependen de `nx test web` / `nx run web:vite:test` — esos tests unitarios de componentes están actualmente rotos por una incompatibilidad de versiones, ver [known-issues.md](known-issues.md). La verificación manual (o con Playwright) descrita en este documento es el camino recomendado mientras ese problema no se resuelva.
