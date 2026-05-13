{
  "name": "uat-generator",
  "version": "1.0.0",
  "description": "Automated responsive UAT PDF reports using Playwright",
  "main": "generate-uat.js",
  "scripts": {
    "start": "node generate-uat.js",
    "postinstall": "playwright install chromium"
  },
  "dependencies": {
    "playwright": "^1.45.0"
  }
}
