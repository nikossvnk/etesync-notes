// Bookmark lists, which work like notebooks: making one (and saving bookmarks to it), showing one list's
// bookmarks, renaming one (keeping what's in its meta), deleting one, another device getting them, and
// the Edit button of a notebook
const { launch, session, run, check, api, unique } = require("../lib");
run(async () => {
  const n = unique();
  const [work, renamed] = ["Work " + n, "Work links " + n];
  const [inDefault, inWork, fromChip] = ["Default one " + n, "Work one " + n, "Chip one " + n];
  await api.addBookmark("Bookmarks", { name: inDefault, url: `https://example.org/default-${n}` });
  const lists = async () => (await api.collections("etebase.bookmark")).filter((x) => !x.deleted);
  const listOf = async (name) => (await api.bookmarks()).find((x) => !x.deleted && (x.name === name))?.collection;

  const b = await launch();
  const A = await session(b, "A");
  await A.ctx.route(/^https:\/\/example\.org\//, (r) => r.fulfill({ contentType: "text/html", body: "<title>Example</title>the page" }));
  await A.login();
  const path = () => new URL(A.p.url()).pathname;
  const field = (label) => A.p.locator(`[aria-label="${label}"] >> visible=true`).first();
  const addBookmark = async (name) => {
    await A.btn(/^add bookmark$/i).click(); await A.wait(1500);
    await field("Link").fill(`example.org/${name.replace(/\W/g, "-")}`);
    await field("Title").fill(name);
    await A.btn(/^save bookmark$/i).click(); await A.wait(5000);
  };

  // The lists, from the menu, like the notebooks
  await A.tab("Bookmark lists");
  check("the menu opens the bookmark lists", path() === "/bookmark-lists", path());
  check("which show the list there is", await A.has("Bookmarks"));

  // Making one, which opens it
  await A.btn(/^new$/i).click(); await A.wait(1500);
  check("a new one is a bookmark list", /new bookmark list/i.test(await A.text()));
  await field("Display name (title)").fill(work);
  await field("Description (optional)").fill("for the job");
  await A.btn(/^save$/i).click(); await A.wait(6000);
  const made = (await lists()).find((x) => x.name === work);
  check("it's made on the server, as a bookmark list with its description", made?.meta.description === "for the job", made);
  check("and it's opened", path() === `/bookmark-list/${made?.uid}`, path());
  check("with nothing in it yet", await A.has("No bookmarks in this list.") && !(await A.has(inDefault)));

  // Bookmarks added in a list are saved to it
  await addBookmark(inWork);
  check("a bookmark added in it is saved to it", await listOf(inWork) === work, await listOf(inWork));
  check("and the list shows it, and not the others", path() === `/bookmark-list/${made?.uid}` && await A.has(inWork) && !(await A.has(inDefault)));
  await A.back();
  check("back goes to the lists", path() === "/bookmark-lists", path());
  check("which show it with its description", (await A.text()).includes(work) && (await A.text()).includes("for the job"));

  // All of the bookmarks, with the lists to choose from
  await A.tab("Bookmarks");
  check("all of the bookmarks are shown at first", await A.has(inWork) && await A.has(inDefault));
  await A.btn(new RegExp(`^filter: ${work}$`, "i")).click(); await A.wait(800);
  check("choosing a list shows only its bookmarks", await A.has(inWork) && !(await A.has(inDefault)));
  await addBookmark(fromChip);
  check("adding one then saves it to that list", await listOf(fromChip) === work, await listOf(fromChip));
  await A.p.reload(); await A.wait(6000);
  check("the chosen list is kept", await A.has(inWork) && !(await A.has(inDefault)));

  // Renaming it keeps the keys of its meta that the app doesn't know
  await api.addCollectionMeta("etebase.bookmark", work, { extra: "kept" });
  await A.sync();
  await A.btn(/^edit bookmark list$/i).click(); await A.wait(1500);
  check("the edit button opens the list's form", (await field("Display name (title)").inputValue()) === work);
  await field("Display name (title)").fill(renamed);
  await A.btn(/^save$/i).click(); await A.wait(6000);
  const after = (await lists()).find((x) => x.uid === made?.uid);
  check("renaming it renames it on the server", after?.name === renamed, after);
  check("keeping its description and the other keys", after?.meta.description === "for the job" && after?.meta.extra === "kept", after?.meta);
  check("then it's back on the bookmarks, with the new name", path() === "/bookmarks" && await A.btn(new RegExp(`^filter: ${renamed}$`, "i")).count() === 1);

  // Another device
  const B = await session(b, "B");
  await B.login();
  await B.tab("Bookmarks");
  await B.btn(new RegExp(`^filter: ${renamed}$`, "i")).click(); await B.wait(800);
  check("another device shows the list and its bookmarks", await B.has(inWork) && await B.has(fromChip) && !(await B.has(inDefault)));
  await B.ctx.close();

  // Deleting it, with its bookmarks
  await A.btn(/^edit bookmark list$/i).click(); await A.wait(1500);
  await A.btn(/^delete bookmark list$/i).click(); await A.wait(800);
  check("deleting asks first, with how many bookmarks go with it", await A.has("This bookmark list and its 2 bookmarks will be removed"));
  await A.btn(/^ok$/i).click(); await A.wait(6000);
  check("deleting it deletes it on the server", !(await lists()).some((x) => x.uid === made?.uid));
  check("with its bookmarks, and not the others", !(await listOf(inWork)) && !(await listOf(fromChip)) && await listOf(inDefault) === "Bookmarks");
  check("then all of the bookmarks are shown", path() === "/bookmarks" && await A.has(inDefault) && !(await A.has(inWork)));

  // A notebook's Edit button, from the notes of the notebook chosen with the chips
  const notebook = "Edit button " + n;
  await api.addNote(notebook, "A note " + n, "text");
  await A.tab("Notes"); await A.sync();
  await A.btn(new RegExp(`^filter: ${notebook}$`, "i")).click(); await A.wait(800);
  await A.btn(/^edit notebook$/i).click(); await A.wait(1500);
  check("a notebook's edit button opens its form", (await field("Display name (title)").inputValue()) === notebook);
  await field("Display name (title)").fill(notebook + " renamed");
  await A.btn(/^save$/i).click(); await A.wait(6000);
  check("which renames it on the server", (await api.collections()).some((x) => !x.deleted && (x.name === notebook + " renamed")));
  check("and goes back to its notes", path() === "/" && await A.has("A note " + n) && await A.has(notebook + " renamed"));
  // And from the notebooks, where back leads to the notebook's notes again
  await A.tab("Notebooks");
  await A.open(notebook + " renamed");
  await A.btn(/^edit notebook$/i).click(); await A.wait(1500);
  check("the notebooks have it too", (await field("Display name (title)").inputValue()) === notebook + " renamed");
  await A.back();
  check("and back from it shows the notebook's notes", path() === "/notebooks" && await A.has("A note " + n), path());
  await A.ctx.close();

  await b.close();
});
