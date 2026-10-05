// New notes that are left empty are thrown away, without anything reaching the server
const { launch, session, run, check, api, unique } = require("../lib");
run(async () => {
  const n = unique();
  await api.addNote("My Notes", "Existing " + n, "an existing note");
  const b = await launch();
  const A = await session(b, "A");
  await A.login();
  const listed = (name) => A.has(name);
  const onServer = async (name) => (await api.noteNames()).filter((x) => x.endsWith(name));
  const message = async () => ((await A.p.innerText("body")).match(/Empty note discarded/) || ["-"])[0];

  await A.createNote("Empty " + n);
  await A.back(); await A.wait(4000);
  check("left empty: not listed", !(await listed("Empty " + n)));
  check("with a message", (await message()) === "Empty note discarded");
  check("and not on the server", (await onServer("Empty " + n)).length === 0, await onServer("Empty " + n));

  await A.createNote("Written " + n); await (await A.editor()).fill("some content"); await A.wait(1500);
  await A.back(); await A.wait(6000);
  check("with content: listed", await listed("Written " + n));
  check("and on the server", JSON.stringify(await onServer("Written " + n)) === JSON.stringify(["Written " + n]), await onServer("Written " + n));

  await A.createNote("Cleared " + n); await (await A.editor()).fill("typed"); await A.wait(4000);
  await A.vis("textarea").fill(""); await A.wait(1500);
  await A.back(); await A.wait(6000);
  check("typed, cleared and left: not listed", !(await listed("Cleared " + n)));
  check("deleted on the server too", JSON.stringify(await onServer("Cleared " + n)) === JSON.stringify(["DELETED:Cleared " + n]), await onServer("Cleared " + n));
  check("nothing left to upload", (await A.syncLabel()) === "Sync", await A.syncLabel());

  await A.ctx.setOffline(true); await A.wait(800);
  await A.createNote("Offline empty " + n); await A.back(); await A.wait(2000);
  check("offline, left empty: not listed and nothing to upload", !(await listed("Offline empty " + n)) && (await A.syncLabel()) === "Sync", await A.syncLabel());
  await A.ctx.setOffline(false); await A.wait(6000);
  check("back online, it never reaches the server", (await onServer("Offline empty " + n)).length === 0);

  await A.open("Existing " + n); await A.back(); await A.wait(1500);
  check("an existing note opened and left is still there", await listed("Existing " + n));
  await b.close();
});
