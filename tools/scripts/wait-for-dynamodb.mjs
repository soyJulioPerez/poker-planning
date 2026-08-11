/**
 * Espera a que DynamoDB Local acepte conexiones.
 *
 * `docker start` / `docker run -d` vuelven en cuanto el contenedor arranca, no cuando el
 * proceso Java de adentro está listo para atender. Sin esta espera, el `create-table` que
 * viene después puede correr contra un puerto que todavía no responde, y el modo de falla
 * es confuso: la tabla no queda creada pero el script sigue, y el error recién aparece
 * mucho más tarde como un ResourceNotFoundException en medio de un test.
 *
 * Cualquier respuesta HTTP alcanza como señal de vida: DynamoDB Local contesta 400 a un
 * GET pelado, y eso ya prueba que el puerto está atendiendo.
 *
 * `127.0.0.1` y no `localhost`: en Windows `localhost` resuelve primero a IPv6 y el
 * contenedor no responde por ese camino. Ver docs/known-issues.md.
 */
const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://127.0.0.1:8000';
const TIMEOUT_MS = 30_000;
const INTERVAL_MS = 250;

const deadline = Date.now() + TIMEOUT_MS;
let lastError = 'sin intentos';

while (Date.now() < deadline) {
  try {
    await fetch(ENDPOINT, { signal: AbortSignal.timeout(2000) });
    process.exit(0);
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

console.error(
  [
    `DynamoDB Local no respondió en ${ENDPOINT} después de ${TIMEOUT_MS / 1000}s.`,
    `Último error: ${lastError}`,
    '',
    'Verificá que el contenedor esté corriendo:',
    '  docker ps --filter name=dynamodb-local',
  ].join('\n')
);
process.exit(1);
