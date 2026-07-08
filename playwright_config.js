// QA Bench Playwright configuration.
// The three projects below ARE the mandatory device matrix: every generated
// spec is executed once per project. All run on Chromium so a single browser
// install covers the whole matrix; tablet/mobile add touch + mobile UA.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: process.env.SPEC_DIR || './generated',
  outputDir: process.env.PW_OUT || './results/artifacts',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [
    ['json', { outputFile: process.env.PW_JSON_OUT || './results/report.json' }],
    ['list'],
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'off',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'desktop',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'tablet',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
        userAgent:
          'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    },
  ],
});
