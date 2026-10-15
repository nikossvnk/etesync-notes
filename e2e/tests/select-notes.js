// Selecting notes to delete several at once: with a long press (then a press selects more)
const { launch, session, run, check, api, unique } = require("../lib");

// The notes on the server with the name, "DELETED:" in front of the deleted ones
const onServer = async (name) => (await api.noteNames()).filter((x) => x.endsWith(name));

run(async () => {
  const n = unique();
  // Named to come first in the list, which is sorted by name
  const names = ["Aa one " + n, "Aa two " + n, "Aa three " + n];
  for (const name of names) {
    await api.addNote("My Notes", name, "to select " + name);
  }
  const b = await launch();

  // Phones: a long press selects
  const A = await session(b, "phone");
  await A.login();
  const row = (name) => A.p.locator(`a[href*="/note/"] [aria-label="${name}"] >> visible=true`).first();
  const selected = async (name) => (await row(name).getAttribute("aria-selected")) === "true";
  const longPress = async (name) => {
    await row(name).scrollIntoViewIfNeeded(); await A.wait(300);
    const box = await row(name).boundingBox();
    await A.p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await A.p.mouse.down(); await A.wait(800); await A.p.mouse.up(); await A.wait(800);
  };
  const path = () => new URL(A.p.url()).pathname;

  await longPress(names[0]);
  check("a long press selects a note, without opening it", await selected(names[0]) && path() === "/", path());
  check("the bar says how many are selected", await A.has("1 selected"));
  await row(names[1]).click(); await A.wait(800);
  check("then a press selects another one", await selected(names[1]) && path() === "/" && await A.has("2 selected"));
  await row(names[1]).click(); await A.wait(800);
  check("and pressed again it's not selected", !(await selected(names[1])) && await A.has("1 selected"));
  await A.btn(/^clear selection$/i).click(); await A.wait(800);
  check("clearing the selection selects none", !(await selected(names[0])) && !(await A.has("selected")));
  await row(names[1]).click(); await A.wait(2500);
  check("then a press opens the note again", path().includes("/note/") && (await A.viewerText()).includes("to select " + names[1]));
  await A.back();

  // Deleting two of them
  await longPress(names[0]);
  await row(names[1]).click(); await A.wait(800);
  await A.btn(/^delete selected$/i).click(); await A.wait(800);
  await A.p.getByRole("button", { name: /^ok$/i }).locator("visible=true").last().click(); await A.wait(6000);
  check("deleting the selected notes deletes them on the server",
    JSON.stringify(await onServer(names[0])) === JSON.stringify(["DELETED:" + names[0]]) &&
    JSON.stringify(await onServer(names[1])) === JSON.stringify(["DELETED:" + names[1]]), [await onServer(names[0]), await onServer(names[1])]);
  check("and not the others", JSON.stringify(await onServer(names[2])) === JSON.stringify([names[2]]));
  check("they're gone from the list, and none is selected", !(await A.has(names[0])) && !(await A.has(names[1])) && !(await A.has("selected")));
  await A.ctx.close();

  await b.close();
});
