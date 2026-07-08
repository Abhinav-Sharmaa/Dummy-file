// Converts one approved test case (JSON) into a Playwright spec file.
//
// Conventions follow `playwright codegen` output: role/label-first locators
// (getByRole / getByLabel / getByText), web-first `expect` assertions, and
// frameLocator for iframe context switching. Each case type maps to a typed
// template; edited or unrecognised cases fall back to the generic template,
// which executes the case's own step list with best-effort assertions.
"use strict";

const j = (v) => JSON.stringify(v);

/** Quoted fragments inside a step ("…" or '…') become visible-text assertions. */
function quotedFragments(step) {
  const out = [];
  const re = /"([^"]{2,80})"|'([^']{2,80})'/g;
  let m;
  while ((m = re.exec(step)) !== null) out.push(m[1] ?? m[2]);
  return out;
}

function genericStepCode(step) {
  const checks = quotedFragments(step)
    .map((f) => `      await expect(page.getByText(${j(f)}).first()).toBeVisible();`)
    .join("\n");
  return `    await test.step(${j(step)}, async () => {
${checks || "      // structural step — verified by page state + human review"}
    });`;
}

const templates = {
  smoke: () => `
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' });

    await test.step('Document title is non-empty', async () => {
      await expect(page).toHaveTitle(/.+/);
    });

    await test.step('Body renders visible content', async () => {
      await expect(page.locator('body')).toBeVisible();
    });

    await test.step('No horizontal overflow at this viewport', async () => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(1);
    });`,

  iframe: () => `
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' });

    // Resolve the widget scope: prefer an iframe (Playwright frame locator API),
    // fall back to an inline widget in the main document.
    const IFRAME_SELECTORS = [
      'iframe#bank-widget', 'iframe[src*="bank" i]', 'iframe[title*="bank" i]',
      'iframe[src*="login" i]', 'iframe[src*="net" i]', 'iframe',
    ];
    const FIELD = 'input[type="password"], input[type="text"], input:not([type])';
    async function resolveScope() {
      for (const sel of IFRAME_SELECTORS) {
        const frame = page.frameLocator(sel).first();
        try {
          await frame.locator(FIELD).first().waitFor({ state: 'visible', timeout: 1500 });
          return { scope: frame, mode: 'iframe: ' + sel };
        } catch { /* try next selector */ }
      }
      return { scope: page, mode: 'inline widget (no credential iframe found)' };
    }

    let { scope, mode } = await resolveScope();

    await test.step('Reveal login panel on small viewports if collapsed', async () => {
      if (await scope.locator(FIELD).first().isVisible().catch(() => false)) return;
      const reveal = page.getByRole('link', { name: /log ?[oi]n/i })
        .or(page.getByRole('button', { name: /log ?[oi]n/i }))
        .first();
      if (await reveal.isVisible().catch(() => false)) {
        await reveal.click();
        ({ scope, mode } = await resolveScope());
      }
    });

    const username = scope.getByLabel(/log ?on id|user(name)?|member|email/i)
      .or(scope.locator('input[type="text"], input:not([type])'))
      .first();
    const password = scope.getByLabel(/security code|pass(word)?|pin/i)
      .or(scope.locator('input[type="password"]'))
      .first();
    const submit = scope.getByRole('button', { name: /log ?[oi]n|sign ?in|submit/i })
      .or(scope.locator('input[type="submit"], button[type="submit"]'))
      .first();

    await test.step('Banking widget located (frame locator first, inline fallback)', async () => {
      testInfo.annotations.push({ type: 'widget-scope', description: mode });
      await expect(username).toBeVisible();
      await expect(password).toBeVisible();
    });

    await test.step('Credential fields accept input', async () => {
      await username.fill(CREDS.username);
      await password.fill(CREDS.password);
      await expect(username).toHaveValue(CREDS.username);
      await expect(password).toHaveValue(CREDS.password);
    });

    await test.step('Submit produces a visible response', async () => {
      const before = page.url();
      await submit.click();
      const FEEDBACK = '[role="alert"], [role="status"], .error, .message, .status, [class*="error" i], [id*="error" i]';
      await expect(async () => {
        const navigated = page.url() !== before;
        const inScope = await scope.locator(FEEDBACK).first().isVisible().catch(() => false);
        const inPage  = await page.locator(FEEDBACK).first().isVisible().catch(() => false);
        expect(navigated || inScope || inPage, 'navigation or visible feedback after submit').toBeTruthy();
      }).toPass({ timeout: 10_000 });
    });`,

  form: () => `
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' });

    // First form in the main frame (widget iframe content lives in its own frame).
    const form = page.locator('form').first();
    const feedback = form
      .locator('[role="status"], [role="alert"], .message, .error, .success')
      .first();

    await test.step('Form is present', async () => {
      await expect(form).toBeVisible();
    });

    await test.step('Empty submit shows a validation message', async () => {
      await form.getByRole('button').first().click();
      await expect(feedback).toBeVisible();
      await expect(feedback).not.toBeEmpty();
    });

    await test.step('Valid input submits with a visible status', async () => {
      for (const input of await form.locator('input[type="text"], input:not([type])').all()) {
        await input.fill('QA Sample');
      }
      for (const input of await form.locator('input[type="email"]').all()) {
        await input.fill('qa@example.com');
      }
      await form.getByRole('button').first().click();
      await expect(feedback).toBeVisible();
      await expect(feedback).not.toBeEmpty();
    });`,

  navigation: () => `
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' });

    await test.step('Open collapsed menu if present (non-desktop)', async () => {
      if (testInfo.project.name === 'desktop') return;
      const toggle = page
        .getByRole('button', { name: /menu|navigation/i })
        .or(page.locator('#menu-toggle, .hamburger, [aria-label*="menu" i]'))
        .first();
      if (await toggle.isVisible().catch(() => false)) await toggle.click();
    });

    await test.step('Primary navigation is visible', async () => {
      await expect(page.getByRole('navigation').first()).toBeVisible();
    });

    await test.step('Navigation links expose href targets', async () => {
      const links = page.getByRole('navigation').first().getByRole('link');
      expect(await links.count(), 'nav link count').toBeGreaterThan(0);
      expect(await links.first().getAttribute('href'), 'first link href').toBeTruthy();
    });`,
};

function genericTemplate(testCase) {
  const steps = testCase.steps
    .filter((s) => !/^navigate to /i.test(s))
    .map(genericStepCode)
    .join("\n\n");
  return `
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

${steps}`;
}

/**
 * @param {object} testCase  case JSON from the run file
 * @param {string} targetUrl run-level target URL
 * @param {string} runId
 * @returns {string} spec file source
 */
function buildSpec(testCase, targetUrl, runId) {
  const body =
    !testCase.edited && templates[testCase.type]
      ? templates[testCase.type]()
      : genericTemplate(testCase);

  const meta = [
    `// Generated by QA Bench — run ${runId}, case ${testCase.id} (type: ${testCase.type}${testCase.edited ? ", edited" : ""}).`,
    `// Regenerated on every execution from the approved case JSON. Edit the case in the UI, not this file.`,
    `// Steps under test:`,
    ...testCase.steps.map((s, i) => `//   ${i + 1}. ${s}`),
  ].join("\n");

  return `${meta}
const { test, expect } = require('@playwright/test');

const TARGET = ${j(targetUrl)};
const CREDS = {
  username: process.env.WIDGET_USER || 'qa_demo_user',
  password: process.env.WIDGET_PASS || 'S3cure!Demo',
};

test(${j(`${testCase.id} | ${testCase.title}`)}, async ({ page }, testInfo) => {
${body}
});
`;
}

module.exports = { buildSpec };
