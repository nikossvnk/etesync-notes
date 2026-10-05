// The back button goes one level up, whatever was done before, and never leaves the app
const { launch, session, run, check, api, unique, config } = require("../lib");
run(async () => {
  const n = unique();
  const note = "Navigation " + n;
  await api.addNote("My Notes", note, "for the navigation test");
  const b = await launch();
  const A = await session(b, "A");
  await A.login();
  // Where we are: the path, and whether the top-most back or menu button is shown
  const where = () => A.p.evaluate(() => {
    const top = (name) => [...document.querySelectorAll(`[aria-label="${name}"]`)].some((e) => {
      const r = e.getBoundingClientRect(); if (!r.width) return false;
      const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!at && (e.contains(at) || at.contains(e));
    });
    return { path: location.pathname.replace(/[A-Za-z0-9_-]{32}/g, "ID"), back: top("Back"), menu: top("Main menu") };
  });
  const at = async (label, path, backShown) => {
    const w = await where();
    check(label, w.path === path && w.back === backShown && w.menu === !backShown, w);
  };
  const back = async () => { await A.dismiss(); await A.p.getByRole("button", { name: /^back$/i }).locator("visible=true").last().click(); await A.wait(1500); };
  const menu = async (item) => {
    await A.p.getByRole("button", { name: /^menu$/i }).locator("visible=true").last().click(); await A.wait(800);
    await A.p.getByText(item, { exact: true }).locator("visible=true").last().click({ force: true }); await A.wait(1500);
  };

  await at("home has the menu button, no back button", "/", false);
  await A.open(note); await at("a note", "/notebook/ID/note/ID", true);
  await menu("Edit Properties"); await at("its properties", "/notebook/ID/note/ID/properties", true);
  await back(); await at("back from the properties: the note", "/notebook/ID/note/ID", true);
  await menu("Edit Properties"); await back(); await menu("Edit Properties"); await back();
  await at("after going in and out twice more: still the note", "/notebook/ID/note/ID", true);
  await back(); await at("back from the note: home", "/", false);

  await A.open(note); await menu("Edit Properties");
  await A.p.reload(); await A.wait(6000); await at("reloaded on the properties", "/notebook/ID/note/ID/properties", true);
  await back(); await at("back: the note", "/notebook/ID/note/ID", true);
  await back(); await at("back: home", "/", false);

  await A.p.goto(config.appUrl + "/settings/about"); await A.wait(6000); await at("About loaded directly", "/settings/about", true);
  await back(); await at("back: Settings", "/settings", true);
  await back(); await at("back: home", "/", false);

  await A.tab("Notebooks");
  await A.btn(/^new$/i).click(); await A.wait(1500); await at("new notebook form", "/new-notebook", true);
  await A.p.locator('input[aria-label="Display name (title)"] >> visible=true').last().fill("Nav " + n);
  await A.p.getByRole("button", { name: /^save$/i }).locator("visible=true").last().click(); await A.wait(4000);
  await at("the new notebook", "/notebook/ID", true);
  await back(); await back(); await at("back twice: home", "/", false);

  // Moving a note: the moved note replaces the one it was moved from
  await A.tab("Notes");
  await A.createNote("Moved " + n);
  await (await A.editor()).fill("moved note"); await A.wait(1500);
  await menu("Move"); await at("the move screen", "/notebook/ID/note/ID/move", true);
  await A.p.locator('input[aria-label="Move to Notebook"] >> visible=true').last().click({ force: true }); await A.wait(1000);
  await A.p.getByText("Nav " + n, { exact: true }).locator("visible=true").last().click({ force: true }); await A.wait(800);
  await A.p.getByRole("button", { name: /^move$/i }).locator("visible=true").last().click(); await A.wait(4000);
  await at("moved: the note", "/notebook/ID/note/ID", true);
  // Still the screen that was being written in, so it's still in the editor
  check("it's the moved note, still in the editor", (await A.vis("textarea").inputValue()) === "moved note");
  await back(); await at("back: home, not the move screen", "/", false);
  check("the moved note is listed once", (await A.text()).split("Moved " + n).length - 1 === 1);

  // Deleting a notebook: back home, with nothing stale behind it
  await A.tab("Notebooks"); await A.open("Nav " + n);
  await menu("Manage Notebook"); await at("manage the notebook", "/notebook/ID/manage", true);
  await menu("Edit"); await at("edit the notebook", "/notebook/ID/edit", true);
  await back(); await at("back: manage", "/notebook/ID/manage", true);
  await menu("Edit");
  await A.p.getByRole("button", { name: /^delete collection$/i }).locator("visible=true").last().click(); await A.wait(800);
  await A.p.getByRole("button", { name: /^ok$/i }).locator("visible=true").last().click(); await A.wait(3000);
  await at("deleted: home", "/", false);
  const t = await A.text();
  check("the notebooks are shown, without the deleted one", t.includes("Notebooks") && !t.includes("Nav " + n));
  check("no \"can't be found\" page", !/can.t be found/.test(t));
  await b.close();
});
