#!/usr/bin/env node
// QA Bench runner. Invoked by PHP:  node run.js --run <runId>  [--dry]
//
//  1. Reads data/runs/<id>.json, keeps approved cases.
//  2. Regenerates one Playwright spec per approved case (specBuilder).
//  3. Executes `npx playwright test` — 3 device projects per spec.
//  4. Parses the JSON report into a case × device matrix, copies failure
//     screenshots into public/artifacts/<id>/, writes results back into the
//     run file so the PHP UI can render them.
//
// --dry generates specs and validates them with `playwright test --list`
// without launching browsers (used for CI / smoke-checking the pipeline).
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const IS_WIN = process.platform === "win32"; // npx is npx.cmd on Windows -> needs shell
const { buildSpec } = require("./lib/specBuilder");

const RUNNER = __dirname;
const ROOT = path.dirname(RUNNER);
const RUNS = path.join(ROOT, "data", "runs");
const PUBLIC_ARTIFACTS = path.join(ROOT, "public", "artifacts");

const args = process.argv.slice(2);
const runId = args[args.indexOf("--run") + 1];
const dry = args.includes("--dry");

if (!runId || !/^[\w-]+$/.test(runId)) {
  console.error("Usage: node run.js --run <runId> [--dry]");
  process.exit(2);
}

const runFile = path.join(RUNS, `${runId}.json`);
const statusFile = path.join(RUNS, `${runId}.status.json`);
const reportFile = path.join(RUNS, `${runId}.report.json`);
const pwOutDir = path.join(RUNS, `${runId}.artifacts`);
const specDir = path.join(RUNNER, "generated", runId);

const readRun = () => JSON.parse(fs.readFileSync(runFile, "utf8"));
const saveRun = (run) => {
  const tmp = `${runFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(run, null, 2));
  fs.renameSync(tmp, runFile);
};
const heartbeat = (phase, message) =>
  fs.writeFileSync(statusFile, JSON.stringify({ phase, message, at: new Date().toISOString() }));
const stripAnsi = (s) => String(s ?? "").replace(/\u001b\[[0-9;]*m/g, "");

function generateSpecs(run, approved) {
  fs.rmSync(specDir, { recursive: true, force: true });
  fs.mkdirSync(specDir, { recursive: true });
  for (const testCase of approved) {
    const file = path.join(specDir, `${testCase.id}.spec.js`);
    fs.writeFileSync(file, buildSpec(testCase, run.url, run.id));
    console.log(`spec generated: ${path.relative(ROOT, file)}`);
  }
}

/** Flatten Playwright's nested JSON report into [{caseId, device, status, error, attachments}]. */
function flattenReport(report) {
  const rows = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      const caseId = (spec.title.match(/^TC-\d+/) || [null])[0];
      for (const t of spec.tests ?? []) {
        const last = (t.results ?? [])[t.results.length - 1] ?? {};
        rows.push({
          caseId,
          device: t.projectName,
          status: last.status === "passed" ? "pass" : "fail",
          error: stripAnsi(last.error?.message || "").split("\n")[0].slice(0, 220),
          duration: last.duration ?? 0,
          attachments: last.attachments ?? [],
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return rows;
}

function collectResults(approved) {
  const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
  const shotDir = path.join(PUBLIC_ARTIFACTS, runId);
  fs.rmSync(shotDir, { recursive: true, force: true });
  fs.mkdirSync(shotDir, { recursive: true });

  const results = {};
  for (const row of flattenReport(report)) {
    if (!row.caseId || !row.device) continue;
    results[row.caseId] ??= {};
    const entry = {
      status: row.status,
      duration: row.duration,
      error: row.status === "fail" ? row.error || "assertion failed" : "",
      screenshot: "",
    };
    if (row.status === "fail") {
      const shot = row.attachments.find(
        (a) => a.contentType === "image/png" && a.path && fs.existsSync(a.path)
      );
      if (shot) {
        const name = `${row.caseId}-${row.device}.png`;
        fs.copyFileSync(shot.path, path.join(shotDir, name));
        entry.screenshot = `artifacts/${runId}/${name}`; // relative to public/
      }
    }
    results[row.caseId][row.device] = entry;
  }

  // Any approved case × device pair missing from the report = infra failure.
  for (const c of approved) {
    results[c.id] ??= {};
    for (const device of ["desktop", "tablet", "mobile"]) {
      results[c.id][device] ??= {
        status: "fail",
        duration: 0,
        error: "no result reported (worker crash or spec did not run)",
        screenshot: "",
      };
    }
  }
  return results;
}

function main() {
  const run = readRun();
  const approved = run.cases.filter((c) => c.status === "approved");
  if (approved.length === 0) throw new Error("No approved cases in run file.");

  heartbeat("specs", `Generating ${approved.length} Playwright spec(s)…`);
  generateSpecs(run, approved);

  const env = {
    ...process.env,
    SPEC_DIR: specDir,
    PW_OUT: pwOutDir,
    PW_JSON_OUT: reportFile,
  };

  if (dry) {
    const list = spawnSync("npx", ["playwright", "test", "--list"], {
      cwd: RUNNER, env, encoding: "utf8", shell: IS_WIN,
    });
    process.stdout.write(list.stdout + list.stderr);
    if (list.status !== 0) throw new Error("Spec validation failed.");
    console.log("dry run OK — specs compile and enumerate across 3 projects.");
    return;
  }

  heartbeat("executing", `Running ${approved.length} case(s) × 3 devices…`);
  const pw = spawnSync("npx", ["playwright", "test"], {
    cwd: RUNNER, env, stdio: "inherit",
    timeout: 15 * 60 * 1000, shell: IS_WIN,
  });
  // Non-zero exit just means test failures; a missing report means infra error.
  if (!fs.existsSync(reportFile)) {
    const cause = pw.error ? ` — ${pw.error.message}` : "";
    throw new Error(`Playwright produced no report (exit ${pw.status})${cause}`);
  }

  heartbeat("collecting", "Collecting results and failure screenshots…");
  const results = collectResults(approved);

  const latest = readRun(); // re-read: never clobber UI-side fields
  latest.results = results;
  latest.status = "done";
  latest.finished = new Date().toISOString();
  saveRun(latest);
  console.log(`run ${runId} done.`);
}

try {
  main();
  fs.rmSync(statusFile, { force: true });
} catch (err) {
  console.error(err.stack || String(err));
  try {
    const latest = readRun();
    latest.status = "error";
    latest.error = String(err.message || err);
    saveRun(latest);
  } catch { /* run file unreadable — log is the source of truth */ }
  fs.rmSync(statusFile, { force: true });
  process.exit(1);
}
