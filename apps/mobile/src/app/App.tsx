import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RoomClientProvider } from './core/room-client-context';
import { RootNavigator } from './navigation/RootNavigator';

export const App = () => (
  <SafeAreaProvider>
    <RoomClientProvider>
      <RootNavigator />
    </RoomClientProvider>
  </SafeAreaProvider>
);

export default App;
