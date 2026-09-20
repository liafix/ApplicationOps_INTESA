import { readFile, access } from "node:fs/promises";
const required = [
  "recruiter-demo/index.html",
  "recruiter-demo/styles.css",
  "recruiter-demo/app.js",
  "recruiter-demo/state.mjs",
  "tests/recruiter-demo/state.test.mjs",
  "vercel.json"
];
for (const file of required) await access(file);
const html = await readFile("recruiter-demo/index.html", "utf8");
const js = await readFile("recruiter-demo/state.mjs", "utf8");
const checks = [
  ["candidate disclaimer", html.includes("not an Intesa Sanpaolo product")],
  ["five checkpoints", html.includes("Five checkpoints from alert to safe closure")],
  ["4/4 validation", html.includes("Validation must pass 4 / 4")],
  ["no external scripts", !/https?:\/\//.test(html)],
  ["root cause guard", js.includes("RELEASE_TIMEOUT_REGRESSION")],
  ["explicit rollback", js.includes("ROLLBACK_RELEASE")],
  ["resolution after validation", js.includes("Incident resolution requires 4/4 validation")]
];
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
console.log(`RECRUITER_DEMO_VALIDATE_PASS checks=${checks.length}`);
