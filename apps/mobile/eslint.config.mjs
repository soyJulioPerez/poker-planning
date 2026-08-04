import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    ignores: ['.expo', 'web-build', 'cache', 'dist'],
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
          ignoredDependencies: [
            // room-client-runtime/shared-contracts se resuelven vía path aliases de TS
            // (withNxMetro), no vía npm — declararlos en package.json rompe el `npm ci`
            // aislado de EAS Build (intentan bajarse del registry real y no existen ahí).
            'room-client-runtime',
            'shared-contracts',
            // Requeridos por apps/mobile/.babelrc.js, apps/mobile/metro.config.js, o
            // apps/mobile/app.json (plugins de Expo) — el análisis estático de esta regla
            // solo mira imports en src/**, no requires de archivos de config ni plugins
            // declarados por nombre en app.json. Confirmado necesarios con builds reales
            // de EAS (ver openspec/changes/.../add-mobile-eas-preview-builds/tasks.md).
            'babel-preset-expo',
            'expo-splash-screen',
            'expo-status-bar',
            'expo-system-ui',
            'metro-resolver',
            // Necesarios para el target web de `nx export mobile` (react-native-web) y
            // para los tests (@testing-library/react-native necesita react-test-renderer;
            // react-native-svg es peer de react-native-svg-transformer).
            'react-dom',
            'react-native-screens',
            'react-native-svg',
            'react-native-web',
            'react-test-renderer',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
