// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as Etebase from "etebase";
import { Platform } from "react-native";
import { createSelector } from "reselect";

import * as C from "./constants";
import { store } from "./store";
import { CachedItem, CachedItemsData } from "./store/reducers";
import { bookmarkCollectionsSelector, bookmarksSelector } from "./store/selectors";
import { saveCollectionLocally, saveItemsLocally } from "./sync/SyncManager";

// A bookmark is an item of a bookmarks collection (C.bookmarkColType). Its title is the item's name,
// and the rest is in its meta too, so that lists don't have to decrypt the content of each one. The
// content is just the link, for whatever reads it as text.
export interface BookmarkMetadata extends Etebase.ItemMetadata {
  name: string; // the title
  mtime: number;
  url: string;
  description?: string; // the note
  tags?: string[];
  created?: number;
  // Where it was saved: see SavedFrom (unset in bookmarks saved before this was recorded)
  savedFrom?: SavedFrom;
}

// Where a bookmark was saved: in this app's own screen, shared to it by another app, in etesync-aio
// (the desktop app), or imported (by etesync-aio) from a browser's bookmarks. The same values as there.
export type SavedFrom = "android" | "android-share" | "computer" | "import";

// Says where a bookmark was saved, after "Saved Oct 12, 2026": e.g. "from Android (Share)"
export function savedFromLabel(from: SavedFrom | undefined) {
  switch (from) {
    case "android": return "on Android";
    case "android-share": return "from Android (Share)";
    case "computer": return "on a computer";
    case "import": return "imported from a browser";
    default: return undefined;
  }
}

export interface Bookmark {
  colUid: string;
  uid: string;
  title: string;
  url: string;
  note: string;
  tags: string[];
  created: number;
  mtime: number;
  savedFrom?: SavedFrom;
}

// The details a bookmark is saved with
export interface BookmarkData {
  title: string;
  url: string;
  note: string;
  tags: string[];
}

export const defaultCollectionName = "Bookmarks";

export function toBookmark(colUid: string, uid: string, cached: CachedItem): Bookmark {
  const meta = cached.meta as Partial<BookmarkMetadata>;
  const mtime = meta.mtime ?? 0;
  return {
    colUid,
    uid,
    title: meta.name ?? "",
    url: meta.url ?? "",
    note: meta.description ?? "",
    tags: meta.tags ?? [],
    created: meta.created ?? mtime,
    mtime,
    savedFrom: meta.savedFrom,
  };
}

// The bookmarks (that aren't deleted) of the cached items, the latest first
export function bookmarksFrom(cached: CachedItemsData): Bookmark[] {
  const ret: Bookmark[] = [];
  for (const [colUid, items] of cached.entries()) {
    for (const [uid, item] of items.entries()) {
      if (!item.isDeleted) {
        ret.push(toBookmark(colUid, uid, item));
      }
    }
  }
  return ret.sort((a, b) => b.created - a.created);
}

export function allBookmarks(state: any) {
  return bookmarksFrom(bookmarksSelector(state));
}

// The site of a link, without "www."
export function domainOf(url: string) {
  const match = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url.trim());
  const host = (match) ? match[1].replace(/^[^@]*@/, "").replace(/:\d+$/, "") : url.trim();
  return host.replace(/^www\./i, "").toLowerCase();
}

// What a bookmark is called: its title, or else its site
export function bookmarkTitle(bookmark: { title: string, url: string }) {
  return bookmark.title.trim() || domainOf(bookmark.url) || bookmark.url;
}

// A link as it's saved: with a scheme (https if it has none), and without spaces around it
export function normalizeUrl(url: string) {
  const ret = url.trim();
  if (ret === "") {
    return ret;
  }
  // (a dot before the colon is a host with a port, e.g. "example.com:8080")
  return (/^[a-z][a-z0-9+-]*:/i.test(ret)) ? ret : `https://${ret}`;
}

// Whether it's a link that can be saved: a web address (with a dot in its host, the scheme can be left
// out), or a link with another scheme (e.g. "mailto:")
export function isValidUrl(url: string) {
  const ret = normalizeUrl(url);
  if ((ret === "") || /\s/.test(ret)) {
    return false;
  }
  return (/^https?:/i.test(ret)) ? /^https?:\/\/[^/?#.]+(\.[^/?#.]+)+([/?#:]|$)/i.test(ret) : true;
}

// The link for comparing, to find out whether it was saved already: "https://Example.com/a/" and
// "http://example.com/a" are the same page
export function comparableUrl(url: string) {
  return normalizeUrl(url)
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/#.*$/, "")
    .replace(/\/+$/, "")
    .replace(/^[^/?]+/, (host) => host.toLowerCase());
}

// A web link in a text, e.g. what's shared by an app, which is often the title and then the link
export function findUrl(text: string) {
  const match = /\bhttps?:\/\/[^\s<>"]+/i.exec(text);
  return (match) ? match[0].replace(/[.,;:!?)\]}'"]+$/, "") : undefined;
}

// What another app shared (as the text and the subject of a share), as a link and a title
export function fromShared(text: string, subject?: string) {
  const url = findUrl(text) ?? "";
  // The text without the link is the title, if it's not just the link (and the subject isn't one)
  const rest = text.replace(url, "").replace(/\s+/g, " ").replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g, "").trim();
  const title = (subject && !findUrl(subject)) ? subject.trim() : rest;
  return { url, title };
}

// All of the tags of the bookmarks, the most used first
export function allTags(bookmarks: Bookmark[]) {
  const counts = new Map<string, number>();
  for (const bookmark of bookmarks) {
    for (const tag of bookmark.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort(([a, x], [b, y]) => (y - x) || a.localeCompare(b))
    .map(([tag]) => tag);
}

// A tag as it's saved: without the "#" and the spaces
export function normalizeTag(tag: string) {
  return tag.trim().replace(/^#+/, "").replace(/\s+/g, "-").toLowerCase();
}

// The bookmark lists (collections), the default one ("Bookmarks") first
export const bookmarkListsSelector = createSelector(
  bookmarkCollectionsSelector,
  (cols) => Array.from(cols.entries())
    .map(([uid, col]) => ({ uid, name: col.meta.name ?? defaultCollectionName, description: col.meta.description, color: col.meta.color }))
    .sort((a, b) => ((a.name === defaultCollectionName) ? -1 : (b.name === defaultCollectionName) ? 1 : a.name.localeCompare(b.name)))
);


// The collection to save in: the given one, or else the first one. There's always one: it's created
// (on the device, and uploaded with the next sync) when there's none yet.
async function getCollection(etebase: Etebase.Account, colUid?: string) {
  const colMgr = etebase.getCollectionManager();
  const state = store.getState() as any;
  const cols = bookmarkCollectionsSelector(state);
  const uid = (colUid && cols.has(colUid)) ? colUid : bookmarkListsSelector(state)[0]?.uid;
  if (uid) {
    return colMgr.cacheLoad(cols.get(uid)!.cache);
  }
  const col = await colMgr.create(C.bookmarkColType, { name: defaultCollectionName, mtime: (new Date()).getTime() }, "");
  await saveCollectionLocally(etebase, colMgr, col, true);
  return col;
}

function metaOf(data: BookmarkData, created: number, savedFrom: SavedFrom | undefined): BookmarkMetadata {
  const tags = Array.from(new Set(data.tags.map(normalizeTag).filter((x) => x !== "")));
  return {
    name: data.title.trim(),
    mtime: (new Date()).getTime(),
    url: normalizeUrl(data.url),
    description: data.note.trim() || undefined,
    tags: (tags.length > 0) ? tags : undefined,
    created,
    savedFrom,
  };
}

// Saves a new bookmark (to the device, and uploads it), and returns where it is. "otherMeta" is the
// meta of the bookmark it replaces (when it's moved, or undeleted), to keep what this app doesn't know.
export async function createBookmark(etebase: Etebase.Account, data: BookmarkData, savedFrom: SavedFrom | undefined, colUid?: string, created?: number, otherMeta?: Etebase.ItemMetadata) {
  const col = await getCollection(etebase, colUid);
  const itemMgr = etebase.getCollectionManager().getItemManager(col);
  const meta = { ...otherMeta, ...metaOf(data, created ?? (new Date()).getTime(), savedFrom) };
  const item = await itemMgr.create(meta, meta.url);
  await saveItemsLocally(etebase, col, itemMgr, [item]);
  return { colUid: col.uid, uid: item.uid };
}

function loadItem(etebase: Etebase.Account, colUid: string, uid: string) {
  const state = store.getState() as any;
  const cachedCol = bookmarkCollectionsSelector(state).get(colUid);
  const cachedItem: CachedItem | undefined = state.cache.items.get(colUid)?.get(uid);
  if (!cachedCol || !cachedItem) {
    return undefined;
  }
  const colMgr = etebase.getCollectionManager();
  const col = colMgr.cacheLoad(cachedCol.cache);
  const itemMgr = colMgr.getItemManager(col);
  return { col, itemMgr, item: itemMgr.cacheLoad(cachedItem.cache) };
}

// Changes a bookmark. Moving it to another collection makes a new one there (an item can't change
// its collection), so it returns where it is now. It keeps where it was saved, and what else is in
// its meta that this app doesn't know (e.g. what etesync-aio adds).
export async function updateBookmark(etebase: Etebase.Account, bookmark: Bookmark, data: BookmarkData, colUid?: string) {
  if (colUid && (colUid !== bookmark.colUid)) {
    const loaded = loadItem(etebase, bookmark.colUid, bookmark.uid);
    const ret = await createBookmark(etebase, data, bookmark.savedFrom, colUid, bookmark.created, loaded?.item.getMeta());
    await deleteBookmark(etebase, bookmark);
    return ret;
  }
  const loaded = loadItem(etebase, bookmark.colUid, bookmark.uid);
  if (!loaded) {
    throw new Error("The bookmark is not available anymore");
  }
  const { col, itemMgr, item } = loaded;
  const meta = { ...item.getMeta(), ...metaOf(data, bookmark.created, bookmark.savedFrom) };
  item.setMeta(meta);
  await item.setContent(meta.url);
  await saveItemsLocally(etebase, col, itemMgr, [item]);
  return { colUid: bookmark.colUid, uid: bookmark.uid };
}

export async function deleteBookmark(etebase: Etebase.Account, bookmark: Bookmark) {
  const loaded = loadItem(etebase, bookmark.colUid, bookmark.uid);
  if (!loaded || loaded.item.isDeleted) {
    return;
  }
  const { col, itemMgr, item } = loaded;
  const meta = item.getMeta();
  meta.mtime = (new Date()).getTime();
  item.setMeta(meta);
  item.delete(true);
  await saveItemsLocally(etebase, col, itemMgr, [item]);
}

// Undoes deleting a bookmark. A deleted item can't come back, so it's saved again as a new one.
export async function restoreBookmark(etebase: Etebase.Account, bookmark: Bookmark) {
  // (the deleted one is still on the device)
  const deleted = loadItem(etebase, bookmark.colUid, bookmark.uid);
  return createBookmark(etebase, bookmark, bookmark.savedFrom, bookmark.colUid, bookmark.created, deleted?.item.getMeta());
}

// Puts a bookmark back the way it was before it was changed (e.g. to undo saving it again from a share)
export async function revertBookmark(etebase: Etebase.Account, before: Bookmark) {
  const loaded = loadItem(etebase, before.colUid, before.uid);
  if (!loaded) {
    return;
  }
  const { col, itemMgr, item } = loaded;
  const meta = { ...item.getMeta(), ...metaOf(before, before.created, before.savedFrom) };
  item.setMeta(meta);
  await item.setContent(meta.url);
  await saveItemsLocally(etebase, col, itemMgr, [item]);
}

// The title of a web page, read from it. This contacts the site, so it's only done when asked for
// (and it doesn't work on the web, where browsers don't allow reading other sites).
export async function fetchTitle(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(normalizeUrl(url), {
      signal: controller.signal,
      credentials: "omit",
      // Some sites refuse the default "okhttp" (e.g. Wikipedia), and also a browser's that the request
      // doesn't otherwise look like, so it says what it is, as they ask for
      headers: (Platform.OS === "web") ? undefined : { "User-Agent": `EteSyncNotes (+${C.sourceCode})` },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = (await response.text()).slice(0, 200000);
    const og = /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html) ??
      /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i.exec(html);
    const title = og?.[1] ?? /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1];
    return (title) ? decodeEntities(title).replace(/\s+/g, " ").trim() : undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeEntities(text: string) {
  const named: { [name: string]: string } = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", ndash: "–", mdash: "—" };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === "#") {
      const n = (code[1].toLowerCase() === "x") ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return (Number.isFinite(n)) ? String.fromCodePoint(n) : all;
    }
    return named[code.toLowerCase()] ?? all;
  });
}
