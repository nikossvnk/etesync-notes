// Where a bookmark was saved (savedFrom in its meta, the same as etesync-aio writes): recorded when one
// is saved here, kept (with what else this app doesn't know) when it's changed, moved or undeleted, and
// shown in its edit screen
const { launch, session, run, check, api, unique } = require("../lib");
run(async () => {
  const n = unique();
  const ownUrl = `https://example.org/own-${n}`;
  const sharedUrl = `https://example.net/shared-${n}`;
  const computerUrl = `https://example.com/computer-${n}`;
  const alive = async (link) => (await api.bookmarks()).filter((x) => (x.url === link) && !x.deleted);

  // One saved on a computer (by etesync-aio), with a field this app doesn't know, in a second list
  await api.addBookmark("Bookmarks", { name: `Computer ${n}`, url: computerUrl, savedFrom: "computer", extra: "kept" });
  await api.addBookmark(`Other ${n}`, { name: `Other list ${n}`, url: `https://example.com/other-${n}`, savedFrom: "computer" });

  const b = await launch();
  const A = await session(b, "A");
  await A.ctx.route(/^https:\/\/example\.(org|net|com)\//, (r) => r.fulfill({ contentType: "text/html", body: "<title>Example</title>the page" }));
  await A.login();
  const field = (label) => A.p.locator(`[aria-label="${label}"] >> visible=true`).first();
  const menuItem = (name) => A.p.getByRole("menuitem", { name }).locator("visible=true").first();
  const edit = async (title) => {
    await A.btn(new RegExp(`^more actions for ${title}$`, "i")).click(); await A.wait(800);
    await menuItem("Edit").click(); await A.wait(1500);
  };
  await A.p.getByRole("tab", { name: "Bookmarks" }).locator("visible=true").first().click(); await A.wait(1500);

  // Saved in the app's own screen
  await A.btn(/^add bookmark$/i).click(); await A.wait(1500);
  await field("Link").fill(ownUrl);
  await field("Title").fill(`Own ${n}`);
  await A.btn(/^save bookmark$/i).click(); await A.wait(6000);
  let saved = await alive(ownUrl);
  check("a bookmark saved in the app is saved on the server as saved on Android", saved.length === 1 && saved[0].meta.savedFrom === "android", saved.map((x) => x.meta));
  await edit(`Own ${n}`);
  check("and its edit screen says so", await A.has("on Android"));
  await A.back();

  // Shared to the app
  await A.p.goto(`${new URL(A.p.url()).origin}/share?text=${encodeURIComponent(`Shared ${n} ${sharedUrl}`)}`); await A.wait(4000);
  await A.btn(/^save$/i).click(); await A.wait(5000);
  saved = await alive(sharedUrl);
  check("a shared one is saved on the server as shared on Android", saved.length === 1 && saved[0].meta.savedFrom === "android-share", saved.map((x) => x.meta));
  // Sharing it again (which changes that one) doesn't change where it was saved
  await A.p.goto(`${new URL(A.p.url()).origin}/share?text=${encodeURIComponent(`Shared ${n} ${sharedUrl}`)}`); await A.wait(4000);
  await field("Note").fill("again");
  await A.btn(/^update bookmark$/i).click(); await A.wait(5000);
  saved = await alive(sharedUrl);
  check("sharing it again keeps where it was first saved", saved.length === 1 && saved[0].note === "again" && saved[0].meta.savedFrom === "android-share", saved.map((x) => x.meta));
  await A.btn(/^open bookmarks$/i).click(); await A.wait(2000);

  // One saved on a computer: changed here, it keeps where it was saved and the field this app doesn't know
  await A.sync();
  await edit(`Computer ${n}`);
  check("the edit screen of one saved on a computer says so", await A.has("on a computer"));
  await field("Title").fill(`Computer changed ${n}`);
  await A.btn(/^save changes$/i).click(); await A.wait(6000);
  saved = await alive(computerUrl);
  check("changing it keeps where it was saved, and what else is in its meta", saved.length === 1 && saved[0].name === `Computer changed ${n}` &&
    saved[0].meta.savedFrom === "computer" && saved[0].meta.extra === "kept", saved.map((x) => x.meta));

  // Moved to the other list (which makes a new bookmark there)
  await edit(`Computer changed ${n}`);
  await A.p.getByRole("radio", { name: `Other ${n}` }).locator("visible=true").first().click(); await A.wait(500);
  await A.btn(/^save changes$/i).click(); await A.wait(6000);
  saved = await alive(computerUrl);
  check("moving it to another list keeps them too", saved.length === 1 && saved[0].collection === `Other ${n}` &&
    saved[0].meta.savedFrom === "computer" && saved[0].meta.extra === "kept", saved.map((x) => [x.collection, x.meta]));

  // Deleted, and the deleting undone (which saves it again as a new one)
  await A.btn(new RegExp(`^more actions for computer changed ${n}$`, "i")).click(); await A.wait(800);
  await menuItem("Delete").click(); await A.wait(2500);
  await A.btn(/^undo$/i).click(); await A.wait(6000);
  saved = await alive(computerUrl);
  check("undoing a delete keeps them too", saved.length === 1 && saved[0].meta.savedFrom === "computer" && saved[0].meta.extra === "kept", saved.map((x) => x.meta));
  await A.ctx.close();
  await b.close();
});
