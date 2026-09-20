import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lockPath = new URL("../package-lock.json", import.meta.url);
if (!fs.existsSync(lockPath)) {
  console.error("LOCK_CHECK_FAIL package-lock.json missing");
  process.exit(1);
}
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const root = lock.packages?.[""];
const errors = [];
if (lock.lockfileVersion !== 3)
  errors.push(`lockfileVersion expected 3, got ${lock.lockfileVersion}`);
if (!root) errors.push('root package entry packages[""] missing');
if (lock.name !== pkg.name) errors.push(`lock name expected ${pkg.name}, got ${lock.name}`);
if (lock.version !== pkg.version)
  errors.push(`lock version expected ${pkg.version}, got ${lock.version}`);
for (const section of ["dependencies", "devDependencies"]) {
  const expected = pkg[section] ?? {};
  const actual = root?.[section] ?? {};
  for (const [name, version] of Object.entries(expected)) {
    if (actual[name] !== version)
      errors.push(`${section}.${name} expected ${version}, got ${actual[name] ?? "<missing>"}`);
  }
  for (const name of Object.keys(actual)) {
    if (!(name in expected))
      errors.push(`${section}.${name} present in lock root but absent from package.json`);
  }
}
const exact = {
  "@prisma/client": "6.12.0",
  prisma: "6.12.0",
  vitest: "3.2.7",
  postcss: "8.5.26"
};
for (const [name, version] of Object.entries(exact)) {
  const entry = lock.packages?.[`node_modules/${name}`];
  if (!entry) errors.push(`node_modules/${name} missing from lock`);
  else if (entry.version !== version)
    errors.push(`${name} resolved version expected ${version}, got ${entry.version}`);
}
if (errors.length) {
  for (const error of errors) console.error(`LOCK_CHECK_FAIL ${error}`);
  process.exit(1);
}
console.log("LOCK_CHECK_PASS lockfileVersion=3 root dependency parity=true hardened pins=true");
