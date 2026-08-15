import { Logger } from '@aws-lambda-powertools/logger';

// Instancia unica, compartida por los tres handlers (connect, disconnect, default).
// Cada uno es un Lambda separado con su propio bundle (ver infra/template.yaml), asi que
// esta linea termina copiada en cada bundle tras el tree-shaking de esbuild — normal con
// tres funciones independientes, no una duplicacion evitable.
export const logger = new Logger({ serviceName: 'realtime-api' });
