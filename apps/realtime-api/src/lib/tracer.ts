import { Tracer } from '@aws-lambda-powertools/tracer';

// Instancia unica, compartida por los tres handlers (connect, disconnect, default).
// Cada uno es un Lambda separado con su propio bundle (ver infra/template.yaml), asi que
// esta linea termina copiada en cada bundle tras el tree-shaking de esbuild — normal con
// tres funciones independientes, no una duplicacion evitable.
export const tracer = new Tracer({ serviceName: 'realtime-api' });
