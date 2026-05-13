#!/usr/bin/env node
/**

- UAT Generator — captures responsive screenshots and builds a PDF report.
- Usage: node generate-uat.js –url <url> [–client “Acme”] [–change “…”] [–ticket REF-123]
  */

const { chromium } = require(‘playwright’);
const path = require(‘path’);

const VIEWPORTS = [
{ name: ‘Mobile’,  width: 375,  height: 812,  scale: 2, isMobile: true  },
{ name: ‘Tablet’,  width: 768,  height: 1024, scale: 2, isMobile: true  },
{ name: ‘Desktop’, width: 1440, height: 900,  scale: 1, isMobile: false },
];

// Common cookie / consent banner buttons to auto-dismiss before screenshotting.
// Add more selectors here as you encounter them on client sites.
const COOKIE_SELECTORS = [
‘#onetrust-accept-btn-handler’,
‘#CybotCookiebotDialogBodyButtonAccept’,
‘.cookie-accept’, ‘.accept-cookies’, ‘[aria-label=“Accept cookies”]’,
‘button:has-text(“Accept all”)’,
‘button:has-text(“Accept All”)’,
‘button:has-text(“Accept”)’,
‘button:has-text(“I agree”)’,
‘button:has-text(“Agree”)’,
‘button:has-text(“Got it”)’,
‘button:has-text(“OK”)’,
];

async function dismissCookieBanner(page) {
for (const selector of COOKIE_SELECTORS) {
try {
const el = await page.$(selector);
if (el) {
await el.click({ timeout: 1500 });
await page.waitForTimeout(600);
return true;
}
} catch (_) { /* try next */ }
}
return false;
}

async function captureScreenshots(url) {
const browser = await chromium.launch();
const screenshots = {};

for (const v of VIEWPORTS) {
process.stdout.write(` • ${v.name.padEnd(8)} (${v.width}×${v.height})…`);
const context = await browser.newContext({
viewport: { width: v.width, height: v.height },
deviceScaleFactor: v.scale,
isMobile: v.isMobile,
userAgent: v.isMobile
? ‘Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1’
: undefined,
});
const page = await context.newPage();

```
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
} catch (_) {
  // networkidle can timeout on chatty sites — continue with what we have.
}
await page.waitForTimeout(1500);
await dismissCookieBanner(page);
await page.waitForTimeout(800);

const buf = await page.screenshot({ fullPage: true, type: 'png' });
screenshots[v.name] = { base64: buf.toString('base64'), viewport: v };
await context.close();
console.log('done');
```

}

await browser.close();
return screenshots;
}

function escapeHtml(s = ‘’) {
return String(s)
.replace(/&/g, ‘&’).replace(/</g, ‘<’).replace(/>/g, ‘>’)
.replace(/”/g, ‘"’).replace(/’/g, ‘'’);
}

function buildHtmlReport({ client, project, url, change, ticket, screenshots }) {
const date = new Date().toLocaleString();
const sections = Object.entries(screenshots).map(([name, d]) => ` <section class="vp"> <h2>${name} <span class="size">${d.viewport.width} × ${d.viewport.height}</span></h2> <img src="data:image/png;base64,${d.base64}" alt="${name} screenshot" /> </section>`).join(’\n’);

return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
@page { margin: 18mm; size: A4; }
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, ‘Segoe UI’, sans-serif; color: #111827; line-height: 1.5; margin: 0; }
.cover { padding-bottom: 24px; border-bottom: 3px solid #2563eb; margin-bottom: 28px; }
h1 { font-size: 26px; color: #2563eb; margin: 0 0 6px; }
.subtitle { color: #6b7280; font-size: 13px; margin-bottom: 18px; }
table.meta { width: 100%; border-collapse: collapse; font-size: 13px; }
table.meta td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
table.meta td:first-child { font-weight: 600; color: #6b7280; width: 150px; }
.change-box { background: #f9fafb; border-left: 4px solid #2563eb; padding: 14px 18px; margin-top: 20px; font-size: 13px; border-radius: 0 4px 4px 0; }
.change-box h3 { margin: 0 0 6px; font-size: 13px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; }
.vp { page-break-before: always; margin-top: 24px; }
.vp:first-of-type { page-break-before: auto; }
.vp h2 { font-size: 18px; color: #2563eb; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
.size { font-size: 12px; color: #6b7280; font-weight: normal; margin-left: 10px; }
img { width: 100%; max-width: 100%; border: 1px solid #e5e7eb; border-radius: 4px; display: block; }
.signoff { margin-top: 36px; padding-top: 20px; border-top: 1px solid #e5e7eb; page-break-inside: avoid; }
.signoff h2 { font-size: 16px; color: #2563eb; margin: 0 0 16px; }
.sigrow { display: flex; gap: 24px; margin-top: 22px; }
.sigbox { flex: 1; }
.sigline { border-bottom: 1px solid #9ca3af; min-height: 32px; margin-bottom: 6px; }
.siglabel { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
</style></head><body>

  <div class="cover">
    <h1>UAT Report — Responsive Validation</h1>
    <div class="subtitle">Generated ${escapeHtml(date)}</div>
    <table class="meta">
      <tr><td>Client</td><td>${escapeHtml(client || '—')}</td></tr>
      <tr><td>Project</td><td>${escapeHtml(project || '—')}</td></tr>
      <tr><td>URL Tested</td><td>${escapeHtml(url)}</td></tr>
      <tr><td>Ticket / Ref</td><td>${escapeHtml(ticket || '—')}</td></tr>
    </table>
    <div class="change-box">
      <h3>Change Description</h3>
      <div>${escapeHtml(change || 'No description provided.')}</div>
    </div>
  </div>
  ${sections}
  <div class="signoff">
    <h2>Sign-off</h2>
    <div class="sigrow">
      <div class="sigbox"><div class="sigline"></div><div class="siglabel">Tested by</div></div>
      <div class="sigbox"><div class="sigline"></div><div class="siglabel">Approved by (Client)</div></div>
    </div>
    <div class="sigrow">
      <div class="sigbox"><div class="sigline"></div><div class="siglabel">Date</div></div>
      <div class="sigbox"><div class="sigline"></div><div class="siglabel">Date</div></div>
    </div>
  </div>
  </body></html>`;
}

async function htmlToPdf(html, outputPath) {
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: ‘networkidle’ });
await page.pdf({
path: outputPath,
format: ‘A4’,
printBackground: true,
margin: { top: ‘18mm’, bottom: ‘18mm’, left: ‘15mm’, right: ‘15mm’ },
});
await browser.close();
}

function parseArgs(argv) {
const out = {};
for (let i = 0; i < argv.length; i++) {
if (argv[i].startsWith(’–’)) {
out[argv[i].slice(2)] = argv[i + 1];
i++;
}
}
return out;
}

async function main() {
const args = parseArgs(process.argv.slice(2));
if (!args.url) {
console.log(`
UAT Generator — responsive PDF reports

Usage:
node generate-uat.js –url <url> [options]

Options:
–url       URL to test (required)
–client    Client name
–project   Project name
–change    Change description
–ticket    Ticket / reference number
–output    Output PDF filename (default: uat-<timestamp>.pdf)

Example:
node generate-uat.js \
–url https://example.com \
–client “Acme Co” \
–change “Updated homepage hero and CTA” \
–ticket JIRA-1234
`);
process.exit(1);
}

const outputFile = args.output || `uat-${Date.now()}.pdf`;
const outputPath = path.resolve(outputFile);

console.log(`\nTesting: ${args.url}`);
const screenshots = await captureScreenshots(args.url);
console.log(’  → building PDF…’);
const html = buildHtmlReport({
client: args.client, project: args.project, url: args.url,
change: args.change, ticket: args.ticket, screenshots,
});
await htmlToPdf(html, outputPath);
console.log(`  ✓ saved: ${outputPath}\n`);
}

main().catch(err => { console.error(‘Error:’, err); process.exit(1); });
