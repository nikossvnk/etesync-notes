// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as Etebase from "etebase";

import { asyncDispatch, store } from "./store";
import { CachedCollection, CachedItem } from "./store/reducers";
import { setCacheItem, unsetCacheItem, unsetSyncItem } from "./store/actions";
import { saveItemsLocally } from "./sync/SyncManager";
import { newNotes } from "./newNotes";

export const untitled = "Untitled";

// The name of a note without a title: its first line, without the markdown that starts it
export function nameFromContent(content: string) {
  const line = content.split("\n").map((x) => x.trim()).find((x) => x !== "") ?? "";
  const name = line
    .replace(/^(#{1,6}|>|[-*+](\s+\[[ xX]\])?|\d+\.)\s*/, "")
    .replace(/(\*\*|__|~~|`)/g, "")
    .trim();
  return (name.length > 60) ? name.slice(0, 60).trimEnd() + "…" : name;
}

// The name a note is saved with: its title, or else its first line
export function noteName(title: string, content: string) {
  return title.trim() || nameFromContent(content) || untitled;
}

// Moves a note to another notebook, and returns its uid there. A note can't change its notebook,
// so it's copied to the other one and deleted in the one it was in. A note that never reached the
// server (e.g. a new one) is just replaced on the device, so the server doesn't get a note to delete.
export async function moveNote(etebase: Etebase.Account, from: CachedCollection, fromUid: string, cachedItem: CachedItem, to: CachedCollection, queued: boolean) {
  const colMgr = etebase.getCollectionManager();
  const oldCol = colMgr.cacheLoad(from.cache);
  const oldItemMgr = colMgr.getItemManager(oldCol);
  const oldItem = oldItemMgr.cacheLoad(cachedItem.cache);
  const newCol = colMgr.cacheLoad(to.cache);
  const newItemMgr = colMgr.getItemManager(newCol);

  const meta = oldItem.getMeta();
  meta.mtime = (new Date()).getTime();
  const content = await oldItem.getContent();
  const newItem = await newItemMgr.create(meta, content);

  // Whether it never reached the server, and isn't being uploaded right now (which may make it reach it after all)
  const state = store.getState() as any;
  const neverUploaded = (oldItem.encryptedItem.lastEtag === null) && (state.syncCount === 0);
  if (neverUploaded) {
    if (queued) {
      await saveItemsLocally(etebase, newCol, newItemMgr, [newItem]);
    } else {
      // Not even queued to be uploaded yet (it's still empty)
      await asyncDispatch(setCacheItem(newCol, newItemMgr, newItem));
    }
    store.dispatch(unsetSyncItem(fromUid, oldItem.uid) as any);
    store.dispatch(unsetCacheItem(fromUid, oldItem.uid) as any);
  } else {
    await saveItemsLocally(etebase, newCol, newItemMgr, [newItem]);
    oldItem.setMeta(meta);
    oldItem.delete(true);
    await saveItemsLocally(etebase, oldCol, oldItemMgr, [oldItem]);
  }

  // A new note stays new where it was moved to, so it's still thrown away if it's left empty
  if (newNotes.delete(oldItem.uid)) {
    newNotes.add(newItem.uid);
  }
  return newItem.uid;
}
