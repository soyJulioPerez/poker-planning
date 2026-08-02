process.env['EXPO_PUBLIC_WS_URL'] ??= 'ws://localhost:3001';

// react-native-safe-area-context necesita medidas nativas de layout que no
// existen en el entorno de test; se usa el mock oficial de la librería
// (React Navigation también depende de sus Context internos, no solo del
// componente, así que un mock manual parcial no alcanza).
// El mock oficial usa `export default {...}` (no exports nombrados),
// así que hay que desenvolver `.default` para que los named imports
// (`SafeAreaProvider`, `useSafeAreaInsets`, ...) resuelvan bien.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});

jest.mock('expo/src/winter/ImportMetaRegistry', () => ({
  ImportMetaRegistry: {
    get url() {
      return null;
    },
  },
}));

if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (object) => JSON.parse(JSON.stringify(object));
}
