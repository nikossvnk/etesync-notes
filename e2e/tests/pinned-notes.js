// Pinning notes: they're shown above the others, and the pin is in the note's metadata on the server
const { launch, session, run, check, api, unique } = require("../lib");

run(async () => {
  const n = unique();
  // Named to come first in the list, which is sorted by name
  const [one, two, three] = ["Ab pin one " + n, "Ab pin two " + n, "Ab pin three " + n];
  for (const name of [one, two, three]) {
    await api.addNote("My Notes", name, "content of " + name);
  }
  const mtimeBefore = (await api.noteMeta("My Notes", one)).mtime;
  const b = await launch();

  const A = await session(b, "A");
  await A.login();
  const pinnedCard = (s, name) => s.p.locator(`[data-testid="pinned-notes"] [aria-label="${name}"] >> visible=true`);
  const width = async (l) => (await l.first().boundingBox()).width;
  const section = () => A.p.locator('[data-testid="pinned-notes"] >> visible=true').first();
  const row = (name) => A.p.locator(`a[href*="/note/"] [aria-label="${name}"] >> visible=true`).first();

  // Pinning with a long press, from the list
  check("nothing is pinned yet", await pinnedCard(A, one).count() === 0);
  await row(one).scrollIntoViewIfNeeded();
  const box = await row(one).boundingBox();
  await A.p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await A.p.mouse.down(); await A.wait(800); await A.p.mouse.up(); await A.wait(800);
  await A.btn(/^pin selected$/i).click(); await A.wait(6000);
  const meta = await api.noteMeta("My Notes", one);
  check("pinning a note pins it on the server", meta?.pinned === true, meta);
  check("without changing when it was changed", meta?.mtime === mtimeBefore, [meta?.mtime, mtimeBefore]);
  check("and not the others", !(await api.noteMeta("My Notes", two)).pinned && !(await api.noteMeta("My Notes", three)).pinned);
  check("it's shown in the pinned notes, and not among the others",
    await pinnedCard(A, one).count() === 1 && await A.p.locator(`a[href*="/note/"] [aria-label="${one}"] >> visible=true`).count() === 1);
  check("the list has a pinned section", /PINNED/i.test(await A.text()));
  check("alone, its card is as wide as the row", Math.abs(await width(pinnedCard(A, one)) - await width(section())) < 2,
    [await width(pinnedCard(A, one)), await width(section())]);
  check("and it shows the beginning of the note", (await pinnedCard(A, one).first().innerText()).includes("content of " + one));
  await pinnedCard(A, one).first().click(); await A.wait(2500);
  check("its card opens the note", (await A.viewerText()).includes("content of " + one));

  // Pinning from the note itself
  await A.back();
  await A.open(two);
  await A.btn(/^pin$/i).click(); await A.wait(6000);
  check("the pin button of a note pins it on the server", (await api.noteMeta("My Notes", two))?.pinned === true);
  check("then it's an unpin button", await A.p.getByRole("button", { name: /^unpin$/i }).locator("visible=true").count() === 1);
  await A.back();
  check("and it's shown in the pinned notes", await pinnedCard(A, two).count() === 1);
  const [w1, w2, ws] = [await width(pinnedCard(A, one)), await width(pinnedCard(A, two)), await width(section())];
  check("two cards share the row", Math.abs(w1 - w2) < 2 && w1 < ws * 0.55, [w1, w2, ws]);
  check("and then they don't show the beginning of the notes", !(await pinnedCard(A, one).first().innerText()).includes("content of"));

  // Another device gets the pins
  const B = await session(b, "B");
  await B.login();
  check("another device shows both of them as pinned", await pinnedCard(B, one).count() === 1 && await pinnedCard(B, two).count() === 1);
  await pinnedCard(B, two).first().click(); await B.wait(2500);
  check("and they open there", (await B.viewerText()).includes("content of " + two));
  await B.btn(/^unpin$/i).click(); await B.wait(6000);
  const metaTwo = await api.noteMeta("My Notes", two);
  check("unpinning a note unpins it on the server", metaTwo && !("pinned" in metaTwo), metaTwo);
  await B.back();
  check("and it's not shown as pinned anymore", await pinnedCard(B, two).count() === 0);
  await B.ctx.close();

  // Pinned on a device that's offline while the note is changed elsewhere: both are kept, without a conflict copy
  await A.ctx.setOffline(true); await A.wait(1000);
  await row(three).scrollIntoViewIfNeeded();
  const box3 = await row(three).boundingBox();
  await A.p.mouse.move(box3.x + box3.width / 2, box3.y + box3.height / 2);
  await A.p.mouse.down(); await A.wait(800); await A.p.mouse.up(); await A.wait(800);
  await A.btn(/^pin selected$/i).click(); await A.wait(1500);
  await api.setNoteContent("My Notes", three, "changed elsewhere");
  await A.ctx.setOffline(false); await A.wait(4000);
  await A.sync(); await A.sync();
  check("the note pinned offline is pinned on the server", (await api.noteMeta("My Notes", three))?.pinned === true, await api.noteMeta("My Notes", three));
  check("with the content from elsewhere", (await api.noteContent("My Notes", three)) === "changed elsewhere");
  check("and no conflict copy was made", !(await api.noteNames()).some((x) => x.includes(three + " (conflict copy)")));
  await pinnedCard(A, three).first().click(); await A.wait(2500);
  check("it opens with the content from elsewhere", (await A.noteText()) === "changed elsewhere");
  await A.ctx.close();

  await b.close();
});
