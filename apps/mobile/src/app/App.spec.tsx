import * as React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RoomClientProvider } from './core/room-client-context';
import { HomeScreen } from './screens/HomeScreen';

const fakeNavigation = { replace: jest.fn(), navigate: jest.fn() } as never;
const fakeRoute = { key: 'Home', name: 'Home' as const, params: undefined };

test('renders the home screen with both tabs', () => {
  const { getByText } = render(
    <SafeAreaProvider>
      <RoomClientProvider>
        <HomeScreen navigation={fakeNavigation} route={fakeRoute} />
      </RoomClientProvider>
    </SafeAreaProvider>,
  );

  expect(getByText('Planning Poker')).toBeTruthy();
  expect(getByText('Unirse a sala')).toBeTruthy();
  expect(getByText('Crear sala')).toBeTruthy();
});
