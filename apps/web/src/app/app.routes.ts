import { Route } from '@angular/router';
import { Home } from './pages/home/home';
import { RoomPage } from './pages/room/room';

export const appRoutes: Route[] = [
  { path: '', component: Home },
  { path: 'room/:roomId', component: RoomPage },
];
