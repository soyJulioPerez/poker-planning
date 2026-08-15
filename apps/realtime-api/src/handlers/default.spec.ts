import { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { logger } from '../lib/logger';
import { handler } from './default';

// El resto del handler (el switch de las 10 acciones) ya esta cubierto por los specs de
// cada accion en actions/*.spec.ts. Este archivo cubre solo el caso que esos no pueden:
// un evento del que ni siquiera se puede extraer el connectionId.
describe('handler (default) — evento sin contexto minimo', () => {
  it('loguea el error y relanza si falta requestContext', async () => {
    const evento = {} as unknown as APIGatewayProxyWebsocketEventV2;
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);

    let thrown: unknown;
    try {
      await handler(evento, {} as never, () => undefined);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(TypeError);
    expect(errorSpy).toHaveBeenCalledWith(
      'action.malformed_event',
      expect.objectContaining({ error: expect.any(TypeError) })
    );

    errorSpy.mockRestore();
  });
});
