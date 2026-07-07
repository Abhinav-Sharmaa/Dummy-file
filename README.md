# QA Bench — ticket → test cases → human review → Playwright

A single-purpose PHP web app that turns a pasted ticket into structured test
cases, holds them for human approval, then executes the approved set with
Playwright across a mandatory 3-viewport device matrix — including a
frame-locator flow for the third-party banking widget iframe embedded in the
target pages.

```
ticket + URL ──► TestCaseGenerator (PHP, rule-based)
                    │  ≥3 cases · every case = desktop/tablet/mobile · 1 iframe case
                    ▼
             Review board (PHP UI) ── Approve / Edit / Reject   ◄─ human in the loop
                    │  approved only · edits reset to pending + regenerate scripts
                    ▼
             run.js (Node) ──► specBuilder ──► TC-xxx.spec.js (codegen conventions)
                    │
                    ▼
             @playwright/test · 3 projects: 1920×1080 / 768×1024 / 375×812
                    │  JSON report + only-on-failure screenshots
                    ▼
             results matrix in the PHP UI (pass/fail per case per device)
```

## Why Node for the runner

`@playwright/test` is Playwright's first-party runner: device projects,
parallel workers, JSON reporting and failure screenshots are built in, so the
whole "run every spec on 3 device profiles" requirement is 12 lines of config
instead of custom orchestration. `playwright codegen` also emits JS natively,
so generated specs follow codegen conventions (`getByRole`, `getByLabel`,
`frameLocator`, web-first `expect`) one-to-one. The Python bindings are solid,
but pytest-playwright would make us rebuild the project matrix + reporter glue
we get here for free.

## Layout

```
qa-autotest/
├── public/                     # web root (php -S serves this)
│   ├── index.php               # UI: ticket form → review board → results matrix
│   ├── api.php                 # JSON API (generate/get/save_case/set_status/execute/status/log)
│   ├── assets/app.css|app.js   # vanilla front end
│   ├── artifacts/<runId>/      # failure screenshots (copied by the runner)
│   └── sample-target/          # mock page under test + banking widget iframe
├── app/
│   ├── bootstrap.php            # paths, helpers, id validation
│   ├── TestCaseGenerator.php    # rule-based generation from ticket text
│   ├── Storage.php              # atomic JSON persistence (data/runs/<id>.json)
│   └── Runner.php               # shell_exec bridge → node run.js (background)
├── runner/
│   ├── run.js                   # orchestrator: specs → playwright → results
│   ├── lib/specBuilder.js       # case JSON → .spec.js (typed templates + generic)
│   ├── playwright.config.js     # the 3 mandatory device projects
│   └── generated/<runId>/       # regenerated specs per execution
└── data/runs/                   # run JSON, heartbeat, report, runner log
```

## Requirements

- PHP 8.1+ (CLI is enough — `php -S` serves the app)
- Node 18+
- One-time browser install: `cd runner && npx playwright install chromium`
  (all 3 device profiles run on Chromium; tablet/mobile add touch + mobile UA)

POSIX shell assumed (`Runner.php` backgrounds the runner with `nohup … &`).
On Windows, run under WSL, or swap the command in `Runner.php` for
`start /B node run.js --run <id>`.

## Setup & run

```bash
cd qa-autotest/runner
npm install
npx playwright install chromium

cd ..
php -S 127.0.0.1:8000 -t public
# open http://127.0.0.1:8000
```

## End-to-end walkthrough (sample ticket)

The repo ships a mock target at `public/sample-target/index.php`: a responsive
portal page with a callback form, a collapsing mobile menu, and a third-party
banking widget in an iframe (`bank-widget.php`, demo creds
`qa_demo_user` / `S3cure!Demo`).

1. Open `http://127.0.0.1:8000`.
2. **Target URL:** `http://127.0.0.1:8000/sample-target/index.php`
3. **Ticket description** — paste:

   ```
   TICKET WEB-2417 — Account portal: callback form + banking widget refresh

   Summary: The staging account portal was updated. The "Request a callback"
   form now validates name/email client-side, and the SecureBank sign-in
   widget (third-party iframe) was upgraded to v3.

   Changes:
   - Callback form must block empty submissions and show an inline error
   - Callback form should show a confirmation message after a valid submit
   - Primary navigation must collapse behind a Menu button below 700px
   - Banking widget: empty sign-in must show "Username and password are required."
   - Banking widget: valid demo credentials should show a signed-in state
   - Page should render with no horizontal scroll on mobile widths
   ```

4. **Generate test cases** → 6 cases appear, each locked to all 3 viewports:
   - TC-001 smoke (always) · TC-002 login entry (keyword *sign-in*) ·
     TC-003 form (*form/validates/submit*) · TC-004 navigation (*navigation/Menu*) ·
     TC-005 acceptance criteria (the 6 bullet lines) ·
     TC-006 **banking widget iframe** (always, frame-locator flow)
5. Reject TC-002, **Edit** TC-005 (note it drops back to *pending* — edits
   regenerate the script and need re-approval), approve the rest.
6. **Run approved cases** → the runner regenerates
   `runner/generated/<runId>/TC-xxx.spec.js` and executes 5 × 3 = 15 device
   runs. The matrix fills in live (2s polling); expected: all green.
7. To see a failure screenshot: edit TC-005, add a step
   `Verify: "This copy does not exist"` , approve, run again — that cell goes
   FAIL with a first-line error and a `failure screenshot` link
   (served from `public/artifacts/<runId>/`).

The iframe spec is the frame-locator flow in miniature:

```js
const widget = page
  .frameLocator('iframe#bank-widget, iframe[src*="bank" i], iframe[title*="bank" i], iframe')
  .first();
await widget.getByRole('button', { name: /sign ?in|log ?in|submit/i }).click();
await expect(widget.getByRole('alert')).toContainText(/required/i);   // empty submit rejected
await widget.getByLabel(/user(name)?|email/i).fill(CREDS.username);
await widget.getByLabel(/pass(word)?/i).fill(CREDS.password);
await widget.getByRole('button', { name: /sign ?in|log ?in|submit/i }).click();
await expect(widget.getByRole('alert')).toContainText(/signed in|welcome|success/i);
```

## Pointing it at your real staging pages

- **Widget credentials:** exported env vars override the demo pair —
  `WIDGET_USER=… WIDGET_PASS=… php -S 127.0.0.1:8000 -t public`
  (the PHP process environment is inherited by the runner). Use test
  credentials on test environments only; never wire real banking credentials
  into this tool, and only target pages you're authorized to test.
- **Selectors:** typed templates use resilient role/label locators with
  fallbacks. If your widget's markup differs, the intended path is the HITL
  edit step: adjust the case (quoted strings in steps become visible-text
  assertions), or extend a template in `runner/lib/specBuilder.js`.
- **Generator rules:** keyword → template mapping lives in
  `app/TestCaseGenerator.php`; add branches for your ticket vocabulary.
  Bullet lines and *should/must/verify/ensure* sentences are lifted into the
  acceptance-criteria case automatically.

## CI smoke check

`node runner/run.js --run <id> --dry` regenerates specs and validates them
with `playwright test --list` (no browsers needed) — useful in CI to catch
template/JSON drift.

## Security notes

- Local, single-user tool: no auth, no CSRF tokens. Put it behind auth before
  exposing beyond localhost.
- The run id is the only value that reaches the shell; it's format-validated
  (`^\d{8}-\d{6}-[a-f0-9]{6}$`) and `escapeshellarg`-quoted. Ticket text and
  URL travel via JSON files only.
- All UI rendering is HTML-escaped; artifacts are written under fixed,
  runner-controlled paths.
