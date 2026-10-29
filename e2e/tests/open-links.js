// Links in notes and bookmarks are opened once (the Markdown library used to open a note's link a
// second time itself), and only web, email and phone links are opened (a note can come from someone
// else, in a shared notebook)
const { launch, session, run, check, api, unique } = require("../lib");
run(async () => {
  const n = unique();
  const name = `Links ${n}`;
  const article = `https://news.example.org/article-${n}`;
  const email = `mailto:author-${n}@example.org`;
  await api.addNote("My Notes", name, `Read [the article](${article}), write to [the author](${email}) or [start an app](intent://scan-${n}#Intent;scheme=zxing;end).`);
  const markUrl = `https://bookmarked.example.org/page-${n}`;
  await api.addBookmark("Bookmarks", { name: `Bookmarked ${n}`, url: markUrl, tags: [] });

  const b = await launch();
  const A = await session(b, "A");
  // What the app opens (react-native-web's Linking.openURL opens links with window.open)
  await A.ctx.addInitScript(() => {
    window.__opened = [];
    window.open = (url) => { window.__opened.push(String(url)); return null; };
  });
  const opened = async () => (await A.p.evaluate(() => window.__opened)).filter((x) => x.includes(n));
  await A.login();

  await A.open(name); await A.wait(1500);
  check("the note shows its links", (await A.viewerText()).includes("Read the article, write to the author or start an app"), await A.viewerText());
  const link = (text) => A.p.getByText(text, { exact: true }).locator("visible=true").first();
  await link("the article").click(); await A.wait(1000);
  check("a link in a note is opened once", JSON.stringify(await opened()) === JSON.stringify([article]), await opened());
  await link("the author").click(); await A.wait(1000);
  check("and so is an email link", JSON.stringify(await opened()) === JSON.stringify([article, email]), await opened());
  await link("start an app").click(); await A.wait(1000);
  check("a link to another app isn't opened", (await opened()).length === 2, await opened());

  await A.back(); await A.wait(1000);
  await A.p.getByRole("tab", { name: "Bookmarks" }).locator("visible=true").first().click(); await A.wait(2500);
  await A.p.locator(`[aria-label="Bookmarked ${n}"] >> visible=true`).first().click(); await A.wait(1000);
  check("a bookmark's link is opened once", JSON.stringify(await opened()) === JSON.stringify([article, email, markUrl]), await opened());
  await b.close();
});
