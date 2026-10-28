// Runs all of the tests in tests/ (or the ones given), several at a time (E2E_JOBS, default 4), and
// sums up. Every test has an account of its own (the E2E_USER name with the test's name after it,
// created when it's missing), so that the tests don't see each other's notes. A run of all of them
// starts with emptying these accounts (E2E_KEEP_DATA=1 keeps what's there), as the notes that earlier
// runs left behind would fill the lists that the tests look for their notes in. The output of a test
// is shown when it's done, so that the outputs of the tests don't mix.
const { spawn } = require("child_process");
const fs = require("fs"), path = require("path");
const { api, config } = require("./lib");
const dir = path.join(__dirname, "tests");
const args = process.argv.slice(2);
const tests = (args.length ? args.map((t) => path.basename(t)) : fs.readdirSync(dir).filter((f) => f.endsWith(".js"))).sort();
const jobs = Math.max(1, Number(process.env.E2E_JOBS) || 4);

const runTest = async (t) => {
  const username = `${config.username}-${t.replace(/\.js$/, "")}`;
  const started = Date.now();
  let output = "";
  if (await api.ensureAccount(username)) {
    output += `Created the account ${username}\n`;
  } else if (!args.length && !process.env.E2E_KEEP_DATA) {
    output += `Emptied the account ${username} (deleted ${await api.reset(username)} notebooks)\n`;
  }
  const status = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(dir, t)], { cwd: __dirname, env: { ...process.env, E2E_USER: username } });
    child.stdout.on("data", (d) => { output += d; });
    child.stderr.on("data", (d) => { output += d; });
    child.on("close", resolve);
  });
  console.log(`\n=== ${t} (${Math.round((Date.now() - started) / 1000)} s)\n${output.trimEnd()}`);
  return status === 0;
};

(async () => {
  const results = new Map();
  const queue = [...tests];
  const worker = async () => {
    for (let t; (t = queue.shift());) {
      results.set(t, await runTest(t).catch((e) => {
        console.log(`\n=== ${t}\nFAILED`, e);
        return false;
      }));
    }
  };
  await Promise.all(Array.from({ length: Math.min(jobs, tests.length) }, worker));
  console.log("\n=== Summary");
  for (const t of tests) {
    console.log(`${results.get(t) ? "pass" : "FAIL"}  ${t}`);
  }
  process.exit(tests.every((t) => results.get(t)) ? 0 : 1);
})().catch((e) => {
  console.log("FAILED", e);
  process.exit(1);
});
