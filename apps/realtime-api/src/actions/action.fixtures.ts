import { ServerMessage } from 'shared-contracts';
import { registerLocalTransport } from '../lib/broadcast';

// Fixtures compartidas por los tests de `actions/`.
//
// Los ocho handlers tienen la misma forma —leer la conexión, leer la sala, comprobar
// permiso, escribir, difundir— así que sin esto cada archivo repetiría cuarenta líneas de
// armado idénticas. Con las fixtures acá, cada spec muestra solo lo que su acción tiene de
// distinto, que es lo único que vale la pena leer.
//
// El archivo se excluye del build en `tsconfig.app.json`: es código de test y no tiene por
// qué terminar dentro del bundle de la Lambda.

export const LOCAL_ENDPOINT = 'local://test';
export const ROOM_ID = 'ABC123';

/** Metadatos de una sala en curso: historia asignada, ronda abierta, sin nada resuelto. */
export function salaFixture(overrides: Record<string, unknown> = {}) {
  return {
    PK: `ROOM#${ROOM_ID}`,
    SK: 'META',
    roomId: ROOM_ID,
    deckId: 'fibonacci',
    iconGroupId: null,
    moderatorName: 'ana',
    moderatorIsVoter: true,
    roundPhase: 'voting',
    currentStoryTitle: 'Login con Google',
    resolvedStories: [],
    revealResult: null,
    ttl: 0,
    ...overrides,
  };
}

export function participanteFixture(name: string, overrides: Record<string, unknown> = {}) {
  return {
    PK: `ROOM#${ROOM_ID}`,
    SK: `PARTICIPANT#${name}`,
    name,
    connectionId: `conn-${name}`,
    isModerator: name === 'ana',
    isVoter: true,
    connected: true,
    vote: null,
    icon: null,
    ...overrides,
  };
}

export interface MensajeEnviado {
  connectionId: string;
  message: ServerMessage;
}

/**
 * Engancha el transporte local de `broadcast.ts` y devuelve el arreglo donde se van
 * acumulando los mensajes. Evita tener que mockear el cliente de API Gateway: el propio
 * `broadcast` desvía a este transporte cuando el endpoint empieza con `local://`.
 */
export function capturarMensajes(): MensajeEnviado[] {
  const enviados: MensajeEnviado[] = [];
  registerLocalTransport((connectionId, message) => enviados.push({ connectionId, message }));
  return enviados;
}

export function erroresDe(enviados: MensajeEnviado[]) {
  return enviados.filter((e) => e.message.type === 'error').map((e) => e.message);
}

/** La clave de ordenamiento sobre la que escribió un comando. */
export function claveDe(call: { args: { input: { Key?: Record<string, unknown> } }[] }): string {
  return String(call.args[0].input.Key?.['SK'] ?? '');
}

/**
 * La clave de ordenamiento del item que escribió un `PutCommand`.
 *
 * Va aparte de `claveDe` porque `Put` lleva la clave dentro de `Item` y no en `Key`: es la
 * diferencia entre "escribí este item completo" y "actualizá el de esta clave".
 */
export function claveDeAlta(call: {
  args: { input: { Item?: Record<string, unknown> } }[];
}): string {
  return String(call.args[0].input.Item?.['SK'] ?? '');
}
