// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as Etebase from "etebase";

import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

import { store, persistor, StoreState, asyncDispatch } from "../store";

import { credentialsSelector } from "../credentials";
import { setSyncCollection, setSyncGeneral, setCacheCollection, unsetCacheCollection, setCacheItem, setCacheItemMulti, setSyncItem, unsetSyncItem, addError, performSync, pushMessage, setSyncStatus } from "../store/actions";
import { CachedItem } from "../store/reducers";
import * as C from "../constants";
import { startTask, arrayToChunkIterator } from "../helpers";

const cachedSyncManager = new Map<string, SyncManager>();
export class SyncManager {
  private COLLECTION_TYPES = [C.colType];
  private BATCH_SIZE = 20;

  public static getManager(etebase: Etebase.Account) {
    const cached = cachedSyncManager.get(etebase.user.username);
    if (cached) {
      return cached;
    }

    const ret = new SyncManager();
    cachedSyncManager.set(etebase.user.username, ret);
    return ret;
  }

  public static removeManager(etebase: Etebase.Account) {
    cachedSyncManager.delete(etebase.user.username);
  }

  protected etebase: Etebase.Account;
  protected isSyncing: boolean;
  // Set when a sync was requested (or became needed) while another one was running
  protected resyncNeeded = false;

  private async fetchCollection(col: Etebase.Collection) {
    const storeState = store.getState() as unknown as StoreState;
    const etebase = (await credentialsSelector(storeState))!;
    const syncCollection = storeState.sync.collections.get(col.uid, undefined);

    const colMgr = etebase.getCollectionManager();
    const itemMgr = colMgr.getItemManager(col);

    let stoken = syncCollection?.stoken;
    const limit = this.BATCH_SIZE;
    let done = false;
    while (!done) {
      const items = await itemMgr.list({ stoken, limit });
      // Never overwrite items that have local changes waiting to be pushed.
      // The next push will detect the conflict and resolve it.
      const pending = (store.getState() as unknown as StoreState).sync.items.get(col.uid);
      const data = (pending) ? items.data.filter((item) => !pending.has(item.uid)) : items.data;
      if (data.length !== items.data.length) {
        this.resyncNeeded = true;
      }
      store.dispatch(setCacheItemMulti(col.uid, itemMgr, data));
      done = items.done;
      stoken = items.stoken;
    }

    if (syncCollection?.stoken !== stoken) {
      store.dispatch(setSyncCollection(col.uid, stoken!));
    }
  }

  private async fetchAllCollections() {
    const storeState = store.getState() as unknown as StoreState;
    const etebase = (await credentialsSelector(storeState))!;
    const syncGeneral = storeState.sync.general;

    const colMgr = etebase.getCollectionManager();
    const limit = this.BATCH_SIZE;
    let stoken = syncGeneral?.stoken;
    let done = false;
    while (!done) {
      const collections = await colMgr.list(this.COLLECTION_TYPES, { stoken, limit });
      for (const col of collections.data) {
        const collectionType = col.getCollectionType();
        if (this.COLLECTION_TYPES.includes(collectionType)) {
          if (col.isDeleted) {
            store.dispatch(unsetCacheCollection(colMgr, col.uid));
          } else {
            store.dispatch(setCacheCollection(colMgr, col));
            await this.fetchCollection(col);
          }
        }
      }
      if (collections.removedMemberships) {
        for (const removed of collections.removedMemberships) {
          store.dispatch(unsetCacheCollection(colMgr, removed.uid));
        }
      }
      done = collections.done;
      stoken = collections.stoken;
    }

    if (syncGeneral?.stoken !== stoken) {
      store.dispatch(setSyncGeneral(stoken ?? null));
    }
    return true;
  }

  public markLocalChanges() {
    if (this.isSyncing) {
      this.resyncNeeded = true;
    }
  }

  private getCachedItem(colUid: string, itemUid: string) {
    const storeState = store.getState() as unknown as StoreState;
    return storeState.cache.items.get(colUid)?.get(itemUid);
  }

  // Called after an item was uploaded. "uploadedFrom" is the cache entry the uploaded item was loaded from.
  private async markPushed(col: Etebase.Collection, itemMgr: Etebase.ItemManager, item: Etebase.Item, uploadedFrom: CachedItem) {
    let current = this.getCachedItem(col.uid, item.uid);
    if (current === uploadedFrom) {
      await asyncDispatch(setCacheItem(col, itemMgr, item));
      store.dispatch(unsetSyncItem(col.uid, item.uid));
      return;
    }

    // The item was changed locally while we were uploading it. Reapply the local
    // changes on top of the uploaded revision and leave it queued for the next push.
    while (current) {
      const newer = itemMgr.cacheLoad(current.cache);
      item.setMeta(newer.getMeta());
      await item.setContent(await newer.getContent());
      if (newer.isDeleted) {
        item.delete(true);
      }

      const latest = this.getCachedItem(col.uid, item.uid);
      if (latest === current) {
        break;
      }
      current = latest;
    }
    await asyncDispatch(setCacheItem(col, itemMgr, item));
    this.resyncNeeded = true;
  }

  // The item was changed both locally and on the server. Keep both: the server version
  // stays as the note, and the local version is saved next to it as a conflict copy.
  private async resolveConflict(col: Etebase.Collection, itemMgr: Etebase.ItemManager, itemUid: string) {
    const cached = this.getCachedItem(col.uid, itemUid);
    const remote = await itemMgr.fetch(itemUid);

    if (cached) {
      const local = itemMgr.cacheLoad(cached.cache);
      const localMeta = local.getMeta();
      const localContent = await local.getContent(Etebase.OutputFormat.String);

      let identical = local.isDeleted === remote.isDeleted;
      if (identical && !local.isDeleted) {
        const remoteContent = await remote.getContent(Etebase.OutputFormat.String);
        identical = (remoteContent === localContent) && (remote.getMeta().name === localMeta.name);
      }

      // A local deletion never wins over a change made elsewhere, the note is just restored.
      if (!identical && !local.isDeleted) {
        const copy = await itemMgr.create({
          ...localMeta,
          name: `${localMeta.name} (conflict copy)`,
          mtime: (new Date()).getTime(),
        }, localContent);
        await itemMgr.batch([copy]);
        await asyncDispatch(setCacheItem(col, itemMgr, copy));
        store.dispatch(pushMessage({
          message: `"${localMeta.name}" was also changed elsewhere. Your version was saved as "${localMeta.name} (conflict copy)".`,
          severity: "warning",
        }));
      }
    }

    await asyncDispatch(setCacheItem(col, itemMgr, remote));
    store.dispatch(unsetSyncItem(col.uid, itemUid));
  }

  private async pushAll() {
    const storeState = store.getState() as unknown as StoreState;
    const etebase = (await credentialsSelector(storeState))!;
    const cacheCollections = storeState.cache.collections;
    const cacheItems = storeState.cache.items;
    const syncItemsAll = storeState.sync.items;

    for (const [colUid, syncItems] of syncItemsAll.entries()) {
      const cacheCollection = cacheCollections.get(colUid);
      for (const chunk of arrayToChunkIterator(Array.from(syncItems.keys()), this.BATCH_SIZE)) {
        const entries = [];
        for (const itemUid of chunk) {
          const cacheItem = cacheItems.get(colUid)?.get(itemUid);
          if (cacheCollection && cacheItem) {
            entries.push({ itemUid, cacheItem });
          } else {
            // The notebook or the note is not available locally anymore, nothing to push
            store.dispatch(unsetSyncItem(colUid, itemUid));
          }
        }
        if (entries.length === 0) {
          continue;
        }

        const colMgr = etebase.getCollectionManager();
        const col = colMgr.cacheLoad(cacheCollection!.cache);
        const itemMgr = colMgr.getItemManager(col);
        const items = entries.map(({ cacheItem }) => itemMgr.cacheLoad(cacheItem.cache));

        try {
          // A transaction (unlike a batch) fails if any of the items was changed on the server
          await itemMgr.transaction(items);
          for (let i = 0 ; i < items.length ; i++) {
            await this.markPushed(col, itemMgr, items[i], entries[i].cacheItem);
          }
        } catch (e) {
          if (!(e instanceof Etebase.ConflictError)) {
            throw e;
          }

          // Push one by one to find out which items are conflicting
          for (let i = 0 ; i < items.length ; i++) {
            try {
              await itemMgr.transaction([items[i]]);
              await this.markPushed(col, itemMgr, items[i], entries[i].cacheItem);
            } catch (e) {
              if (!(e instanceof Etebase.ConflictError)) {
                throw e;
              }
              await this.resolveConflict(col, itemMgr, entries[i].itemUid);
            }
          }
        }
      }
    }

    return true;
  }

  public async sync(alwaysThrowErrors = false) {
    if (this.isSyncing) {
      return false;
    }
    this.isSyncing = true;
    this.resyncNeeded = false;

    try {
      store.dispatch(setSyncStatus("Pushing changes"));
      await this.pushAll();
      store.dispatch(setSyncStatus("Pulling changes"));
      const stoken = await this.fetchAllCollections();
      return stoken;
    } catch (e) {
      if (alwaysThrowErrors) {
        throw e;
      }

      if (e instanceof Etebase.NetworkError || e instanceof Etebase.TemporaryServerError) {
        // Ignore network errors
        return null;
      } else if (e instanceof Etebase.PermissionDeniedError) {
        store.dispatch(addError(e));
        return null;
      } else if (e instanceof Etebase.HttpError) {
        store.dispatch(addError(e));
        return null;
      }
      throw e;
    } finally {
      this.isSyncing = false;
      if (this.resyncNeeded && (store.getState() as unknown as StoreState).connection?.isConnected !== false) {
        setTimeout(() => {
          if (this.resyncNeeded) {
            store.dispatch(performSync(this.sync()));
          }
        }, 1000);
      }
    }
  }
}

// Sync in the background without waiting for the result.
// Pass localChanges when there is something new to push, so that it is not
// missed if a sync is already running.
export function requestSync(etebase: Etebase.Account, localChanges = false) {
  const syncManager = SyncManager.getManager(etebase);
  if (localChanges) {
    syncManager.markLocalChanges();
  }
  store.dispatch(performSync(syncManager.sync()));
}

// Save items to the local cache and queue them to be pushed to the server.
// This always works, even when offline.
export async function saveItemsLocally(etebase: Etebase.Account, col: Etebase.Collection, itemMgr: Etebase.ItemManager, items: Etebase.Item[]) {
  for (const item of items) {
    await asyncDispatch(setCacheItem(col, itemMgr, item));
    store.dispatch(setSyncItem(col.uid, item.uid));
  }
  requestSync(etebase, true);
}

function persistorLoaded() {
  return new Promise((resolve, _reject) => {
    const subscription = {} as { unsubscribe: () => void };
    subscription.unsubscribe = persistor.subscribe(() => {
      const { bootstrapped } = persistor.getState();
      if (bootstrapped) {
        resolve(true);
        subscription.unsubscribe();
      }
    });
    if (persistor.getState().bootstrapped) {
      resolve(true);
      subscription.unsubscribe();
    }
  });
}

const BACKGROUND_SYNC_TASK_NAME = "SYNCMANAGER_SYNC";

TaskManager.defineTask(BACKGROUND_SYNC_TASK_NAME, async () => {
  const timeout = startTask(() => true, 27 * 1000); // Background fetch is limited to 30 seconds.

  try {
    await persistorLoaded();
    const beforeState = store.getState() as unknown as StoreState;
    const etebase = await credentialsSelector(beforeState);

    if (!etebase) {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const syncManager = SyncManager.getManager(etebase);
    const sync = syncManager.sync();
    Promise.race([timeout, sync]);
    store.dispatch(performSync(sync));

    const afterState = store.getState() as unknown as StoreState;
    const receivedNewData =
      (beforeState.cache.collections !== afterState.cache.collections) ||
      (beforeState.cache.items !== afterState.cache.items);

    return receivedNewData ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export function registerSyncTask(_username: string) {
  return BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK_NAME, {
    minimumInterval: 4 * 60 * 60, // 4 hours
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

export function unregisterSyncTask(_username: string) {
  return BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK_NAME);
}
