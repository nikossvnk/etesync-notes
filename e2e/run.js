// Runs all of the tests in tests/ (or the ones given), one after the other, and sums up
const { spawnSync } = require("child_process");
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "tests");
const tests = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
const results = [];
for (const t of tests) {
  console.log(`\n=== ${t}`);
  const r = spawnSync(process.execPath, [path.join(dir, path.basename(t))], { stdio: "inherit", cwd: __dirname });
  results.push([t, r.status === 0]);
}
console.log("\n=== Summary");
for (const [t, ok] of results) {
  console.log(`${ok ? "pass" : "FAIL"}  ${t}`);
}
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
