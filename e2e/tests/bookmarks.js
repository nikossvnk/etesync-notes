// Bookmarks: adding one (with a note and a tag), finding it, opening it, changing it, deleting it (and
// undoing that), saving a shared link (and the same one again), that the notes don't show them, and
// that they reach another device
const { launch, session, run, check, api, unique } = require("../lib");
run(async () => {
  const n = unique();
  const url = `https://example.org/page-${n}`;
  const sharedUrl = `https://example.net/shared-${n}`;
  // The bookmarks on the server with the link, deleted ones too
  const onServer = async (link) => (await api.bookmarks()).filter((x) => x.url === link);
  const alive = async (link) => (await onServer(link)).filter((x) => !x.deleted);

  const b = await launch();
  const A = await session(b, "A");
  // The pages of the links, without going to the internet
  await A.ctx.route(/^https:\/\/example\.(org|net)\//, (r) => r.fulfill({ contentType: "text/html", body: "<title>Example</title>the page" }));
  await A.login();
  const path = () => new URL(A.p.url()).pathname;
  const field = (label) => A.p.locator(`[aria-label="${label}"] >> visible=true`).first();
  const menuItem = (name) => A.p.getByRole("menuitem", { name }).locator("visible=true").first();

  await A.p.getByRole("tab", { name: "Bookmarks" }).locator("visible=true").first().click(); await A.wait(1500);
  check("the bookmarks tab opens the bookmarks", path() === "/bookmarks", path());

  // Adding one
  await A.btn(/^add bookmark$/i).click(); await A.wait(1500);
  await field("Link").fill(`example.org/page-${n}`);
  await field("Title").fill(`Example ${n}`);
  await field("Note").fill("for later");
  await field("New tag").fill("reading");
  await field("New tag").press("Enter"); await A.wait(300);
  check("a typed tag is added", await A.p.getByRole("button", { name: "Remove tag reading" }).count() === 1);
  await A.btn(/^save bookmark$/i).click(); await A.wait(6000);
  let saved = await alive(url);
  check("it's saved on the server with its details, the link with https in front", saved.length === 1 &&
    saved[0].name === `Example ${n}` && saved[0].note === "for later" && JSON.stringify(saved[0].tags) === "[\"reading\"]" &&
    saved[0].content === url && saved[0].collection === "Bookmarks", saved);
  check("then it's back in the list, which shows it", path() === "/bookmarks" && await A.has(`Example ${n}`) &&
    await A.has("example.org") && await A.has("for later") && await A.has("#reading"));

  // Finding it
  const search = field("Search bookmarks");
  await search.fill(`page-${n}`); await A.wait(500);
  check("searching for its link finds it", await A.has(`Example ${n}`));
  await search.fill(`nothing-like-it-${n}`); await A.wait(500);
  check("searching for something else doesn't", !(await A.has(`Example ${n}`)) && await A.has("No bookmarks match the search."));
  await search.fill(""); await A.wait(500);
  await A.btn(/^filter: #reading$/i).click(); await A.wait(500);
  check("its tag shows it", await A.has(`Example ${n}`));
  await A.btn(/^filter: all$/i).click(); await A.wait(500);

  // A press opens the link
  const [page] = await Promise.all([
    A.ctx.waitForEvent("page"),
    A.p.getByRole("link", { name: `Example ${n}` }).locator("visible=true").first().click(),
  ]);
  await page.waitForLoadState().catch(() => undefined);
  check("pressing it opens the link", page.url() === url, page.url());
  await page.close();

  // The notes don't show it
  await A.p.getByRole("tab", { name: "Notes" }).locator("visible=true").first().click(); await A.wait(1500);
  check("the notes tab opens the notes", path() === "/" && await A.has("Search") && !(await A.has(`Example ${n}`)));
  check("and the bookmarks aren't a notebook there", await A.p.getByRole("button", { name: "Filter: Bookmarks" }).count() === 0);
  await A.p.getByRole("tab", { name: "Bookmarks" }).locator("visible=true").first().click(); await A.wait(1500);

  // Changing it
  await A.btn(new RegExp(`^more actions for example ${n}$`, "i")).click(); await A.wait(800);
  await menuItem("Edit").click(); await A.wait(1500);
  check("edit opens it with its details", await field("Title").inputValue() === `Example ${n}` && await field("Link").inputValue() === url);
  await field("Title").fill(`Changed ${n}`);
  await A.btn(/^remove tag reading$/i).click(); await A.wait(300);
  await A.btn(/^save changes$/i).click(); await A.wait(6000);
  saved = await alive(url);
  check("the change is saved on the server", saved.length === 1 && saved[0].name === `Changed ${n}` && !saved[0].tags, saved);
  check("and shown", await A.has(`Changed ${n}`) && !(await A.has(`Example ${n}`)));

  // Deleting it, and undoing that
  await A.btn(new RegExp(`^more actions for changed ${n}$`, "i")).click(); await A.wait(800);
  await menuItem("Delete").click(); await A.wait(2500);
  check("delete takes it away right away", !(await A.has(`Changed ${n}`)) && await A.has("Bookmark deleted"));
  check("and deletes it on the server", (await alive(url)).length === 0 && (await onServer(url)).some((x) => x.deleted));
  await A.btn(/^undo$/i).click(); await A.wait(6000);
  saved = await alive(url);
  check("undo brings it back", await A.has(`Changed ${n}`));
  check("on the server too", saved.length === 1 && saved[0].name === `Changed ${n}`, saved);

  // A shared link: the title comes from what was shared
  const share = async () => {
    await A.p.goto(`${new URL(A.p.url()).origin}/share?text=${encodeURIComponent(`Shared page ${n} - Example ${sharedUrl}`)}`);
    await A.wait(4000);
  };
  await share();
  check("sharing a link opens the sheet to save it", await A.has("Save bookmark") && await field("Title").inputValue() === `Shared page ${n} - Example`);
  await field("Note").fill("shared once");
  await A.btn(/^save$/i).click(); await A.wait(5000);
  check("saving it says so", await A.has("Bookmark saved"));
  saved = await alive(sharedUrl);
  check("and saves it on the server", saved.length === 1 && saved[0].name === `Shared page ${n} - Example` && saved[0].note === "shared once", saved);

  // The same link again changes that one
  await share();
  check("sharing it again says it's there already", await A.has("Already in Bookmarks") && await field("Note").inputValue() === "shared once");
  await field("Note").fill("shared twice");
  await A.btn(/^update bookmark$/i).click(); await A.wait(5000);
  saved = await alive(sharedUrl);
  check("updating it changes the one that's there", await A.has("Bookmark updated") && saved.length === 1 && saved[0].note === "shared twice", saved);
  await A.btn(/^undo$/i).click(); await A.wait(5000);
  saved = await alive(sharedUrl);
  check("and undo puts it back the way it was", saved.length === 1 && saved[0].note === "shared once", saved);
  await A.btn(/^save$|^update bookmark$/i).click(); await A.wait(4000);
  await A.btn(/^open bookmarks$/i).click(); await A.wait(2000);
  check("open bookmarks goes to them", path() === "/bookmarks" && await A.has(`Shared page ${n} - Example`));

  // Adding a link that's saved already starts from that bookmark, so updating it keeps what it has
  const before = (await alive(sharedUrl))[0];
  await A.p.goto(`${new URL(A.p.url()).origin}/new-bookmark?url=${encodeURIComponent(sharedUrl)}`); await A.wait(4000);
  check("adding a saved link says so, and fills in its details", await A.has("You saved this link") &&
    await field("Title").inputValue() === `Shared page ${n} - Example` && await field("Note").inputValue() === before.note);
  await A.btn(/^update bookmark$/i).click(); await A.wait(5000);
  saved = await alive(sharedUrl);
  check("and updating it keeps them", saved.length === 1 && saved[0].note === before.note && saved[0].name === `Shared page ${n} - Example`, saved);
  await A.ctx.close();

  // Another device gets them
  const B = await session(b, "B");
  await B.login();
  await B.p.getByRole("tab", { name: "Bookmarks" }).locator("visible=true").first().click(); await B.wait(2000);
  check("another device shows them after logging in", await B.has(`Changed ${n}`) && await B.has(`Shared page ${n} - Example`));
  await b.close();
});
