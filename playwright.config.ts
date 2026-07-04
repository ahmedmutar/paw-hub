import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'e2e/report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Start both API and frontend before tests
  webServer: [
    {
      command: 'npm run dev',
      cwd: './api',
      url: 'http://localhost:3001/health',
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        DATABASE_URL: 'postgresql://ahmadmukhtar@localhost:5432/vetclinic',
        JWT_SECRET: 'bintang-vet-clinic-jwt-secret-2025-super-aman',
        PORT: '3001',
        NODE_ENV: 'development',
      },
    },
    {
      command: 'npm run dev',
      cwd: './frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
