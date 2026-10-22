// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import { createSelector } from "reselect";

import * as C from "../constants";
import { CachedCollectionsData, CachedItemsData } from "./reducers";

// The cache has the collections of all types (notebooks and bookmarks), these are the ones of one type
// and their items. They only change when the cache does, so they can be used like it.
interface CacheState {
  cache: {
    collections: CachedCollectionsData;
    items: CachedItemsData;
  };
}

function collectionsOfType(type: string) {
  return createSelector(
    (state: CacheState) => state.cache.collections,
    (collections) => collections.filter((x) => x.collectionType === type)
  );
}

function itemsOfType(collections: (state: CacheState) => CachedCollectionsData) {
  return createSelector(
    collections,
    (state: CacheState) => state.cache.items,
    (cols, items) => items.filter((_x, colUid) => cols.has(colUid))
  );
}

export const notebooksSelector = collectionsOfType(C.colType);
export const notesSelector = itemsOfType(notebooksSelector);
// The notebooks by name, as they're listed and chosen from
export const sortedNotebooksSelector = createSelector(
  notebooksSelector,
  (cols) => Array.from(cols.entries())
    .map(([uid, col]) => ({ uid, name: col.meta.name ?? "", description: col.meta.description, color: col.meta.color }))
    .sort((a, b) => (a.name.toUpperCase() >= b.name.toUpperCase()) ? 1 : -1)
);
export const bookmarkCollectionsSelector = collectionsOfType(C.bookmarkColType);
export const bookmarksSelector = itemsOfType(bookmarkCollectionsSelector);
