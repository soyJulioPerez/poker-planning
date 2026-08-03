import { test as base } from '@playwright/test';
import { HomePage } from './pages/home.page';
import { RoomPage } from './pages/room.page';

export const test = base.extend<{ homePage: HomePage; roomPage: RoomPage }>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  roomPage: async ({ page }, use) => {
    await use(new RoomPage(page));
  },
});

export { expect } from '@playwright/test';
