// Creates the test account on the test server (it has to allow signing up, like the test-server
// image of the Etebase server does), with a notebook, if it doesn't exist yet. run.js creates the
// accounts of its tests by itself; this one is for running a test directly (node tests/offline.js).
const { config, api } = require("./lib");
(async () => {
  const created = await api.ensureAccount();
  console.log(created ? `Created the account ${config.username} with the notebook "My Notes"` : `The account ${config.username} exists already`);
})().catch((e) => { console.log("FAILED", e); process.exit(1); });
