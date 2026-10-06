// Wide screens: the sidebar with the notebooks and their notes
const { launch, session, run, check, api, unique } = require("../lib");
run(async () => {
  const n = unique();
  const other = "Sidebar " + n;
  await api.addNote("My Notes", "First " + n, "the first note");
  await api.addNote("My Notes", "Second " + n, "the second note");
  await api.addNote(other, "Third " + n, "the third note");
  const b = await launch();

  // Not on narrow screens
  const narrow = await session(b, "narrow");
  await narrow.login();
  check("no sidebar on a narrow screen", await narrow.p.locator('[data-testid="sidebar"] >> visible=true').count() === 0);
  await narrow.ctx.close();

  const A = await session(b, "A", { width: 1280, height: 800 });
  await A.login();
  const sidebar = A.p.locator('[data-testid="sidebar"] >> visible=true');
  const row = (label) => sidebar.getByRole("button", { name: label, exact: true });
  const shown = async (label) => (await row(label).count()) > 0;
  const selected = async (label) => (await row(label).getAttribute("aria-selected")) === "true";
  const path = () => new URL(A.p.url()).pathname.replace(/[A-Za-z0-9_-]{32}/g, "ID");
  // The cards of the notes list, which has the notes of all notebooks or of one
  const cards = () => A.p.locator('[aria-label] >> visible=true').evaluateAll((els) => els
    .filter((e) => !e.closest('[data-testid="sidebar"]') && e.closest('a[href*="/note/"]'))
    .map((e) => e.getAttribute("aria-label")));

  check("the sidebar is shown on a wide screen", await sidebar.count() === 1);
  check("with the notebooks", await shown("Notebook My Notes") && await shown("Notebook " + other));
  check("and their notes", await shown("Note First " + n) && await shown("Note Second " + n) && await shown("Note Third " + n));
  check("the notebook filter above the list isn't shown next to it", await A.p.getByRole("button", { name: /^Filter: / }).locator("visible=true").count() === 0);

  // Opening notes
  await row("Note First " + n).click(); await A.wait(2500);
  check("a note opens from the sidebar", path() === "/notebook/ID/note/ID" && (await A.viewerText()).includes("the first note"));
  check("and is the selected one", await selected("Note First " + n) && !(await selected("Note Second " + n)));
  await row("Note Third " + n).click(); await A.wait(2500);
  check("another note opens in its place", (await A.viewerText()).includes("the third note") && await selected("Note Third " + n));
  await A.back();
  check("back goes to the list, not to the note before", path() === "/", path());

  // Changes are saved when going to another note from the sidebar
  await row("Note Second " + n).click(); await A.wait(2500);
  await (await A.editor()).fill("the second note, changed"); await A.wait(500);
  await row("Note First " + n).click(); await A.wait(6000);
  const second = () => api.noteContent("My Notes", "Second " + n);
  check("an edited note is saved when another one is opened from the sidebar", (await second()) === "the second note, changed",
    [await second(), (await api.noteNames()).filter((x) => x.includes(n))]);

  // A new note that's left empty for another note is thrown away
  const notesBefore = (await api.noteNames()).length;
  await row("New note in " + other).click(); await A.wait(2500);
  check("a new note from the sidebar is in its notebook", (await A.notebookOfNote()) === other, await A.notebookOfNote());
  check("the new note is in the sidebar", await shown("Note Untitled"));
  await row("Note Third " + n).click(); await A.wait(4000);
  check("left empty for another note: thrown away", !(await shown("Note Untitled")) && (await A.viewerText()).includes("the third note"));
  check("and not on the server", (await api.noteNames()).length === notesBefore);

  // A notebook shows its notes in the list
  await row("Notebook " + other).click(); await A.wait(2500);
  check("a notebook opens the list of its notes", path() === "/" && JSON.stringify(await cards()) === JSON.stringify(["Third " + n]), [path(), await cards()]);
  check("and is the selected one", await selected("Notebook " + other) && !(await selected("All notes")));
  await row("All notes").click(); await A.wait(1500);
  const all = await cards();
  check("all notes lists the notes of all notebooks", all.includes("First " + n) && all.includes("Third " + n), all);

  // Closing and opening a notebook
  await row("Close " + other).click(); await A.wait(500);
  check("a closed notebook doesn't show its notes", !(await shown("Note Third " + n)) && await shown("Note First " + n));
  await row("Open " + other).click(); await A.wait(500);
  check("opened again it does", await shown("Note Third " + n));

  // Finding notes
  const find = A.p.locator('input[aria-label="Find a note"] >> visible=true');
  await find.fill("third " + n); await A.wait(500);
  check("finding a note shows only the notes that match", await shown("Note Third " + n) && !(await shown("Note First " + n)) && !(await shown("Notebook My Notes")));
  await row("Close " + other).click().catch(() => {}); await A.wait(300);
  await find.fill("nothing like this " + n); await A.wait(500);
  check("and says so when nothing matches", (await sidebar.innerText()).includes("No notes found"));
  await sidebar.getByRole("button", { name: "Clear" }).click(); await A.wait(500);
  check("clearing it shows everything again", await shown("Note First " + n) && await shown("Notebook " + other));

  // Hiding it, which is remembered
  await row("Hide the sidebar").click(); await A.wait(800);
  check("the sidebar can be hidden", await sidebar.count() === 0);
  check("then the notebook filter is back above the list", await A.p.getByRole("button", { name: /^Filter: / }).locator("visible=true").count() > 0);
  await A.p.reload(); await A.wait(6000);
  check("it stays hidden after reloading", await sidebar.count() === 0);
  await A.btn(/^show the sidebar$/i).click(); await A.wait(800);
  check("and can be shown again", await sidebar.count() === 1 && await shown("Note First " + n));

  // Changing its width by dragging its edge, which is remembered
  const width = async () => Math.round((await sidebar.boundingBox()).width);
  const drag = async (dx) => {
    const handle = (await A.p.locator('[data-testid="sidebar-resize"] >> visible=true').boundingBox());
    const x = handle.x + handle.width / 2, y = handle.y + 300;
    await A.p.mouse.move(x, y); await A.p.mouse.down();
    await A.p.mouse.move(x + dx / 2, y, { steps: 5 }); await A.p.mouse.move(x + dx, y, { steps: 5 });
    await A.p.mouse.up(); await A.wait(800);
  };
  const before = await width();
  await drag(120);
  check("dragging the edge makes the sidebar wider", Math.abs((await width()) - (before + 120)) <= 2, [before, await width()]);
  const cardsLeft = async () => Math.round((await A.p.locator('a[href*="/note/"] >> visible=true').first().boundingBox()).x);
  check("and the screen next to it narrower", (await cardsLeft()) > before + 120, await cardsLeft());
  await A.p.reload(); await A.wait(6000);
  check("the width stays after reloading", Math.abs((await width()) - (before + 120)) <= 2, await width());
  await drag(-1000);
  check("it doesn't get narrower than 200 pixels", (await width()) === 200, await width());
  await drag(2000);
  check("or wider than 600", (await width()) === 600, await width());
  await drag(before - 600);
  check("and can be dragged back", Math.abs((await width()) - before) <= 2, await width());

  // New notebook
  await row("New notebook").click(); await A.wait(1500);
  check("new notebook opens the form for it", path() === "/new-notebook", path());
  await b.close();
});
