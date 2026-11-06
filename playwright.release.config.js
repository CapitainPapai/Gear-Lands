import { defineConfig } from '@playwright/test';

// Runs after npm run build. No Vite dev server is used: these tests exercise
// the actual standalone file and the actual production directory on a subpath.
export default defineConfig({
  testDir: './tests/release',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    viewport: { width: 1280, height: 800 },
    headless: true,
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
      args: ['--disable-gpu'],
    },
  },
  webServer: {
    command: 'node scripts/serve-pages.mjs',
    url: 'http://127.0.0.1:4174/Gear-Lands/',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
