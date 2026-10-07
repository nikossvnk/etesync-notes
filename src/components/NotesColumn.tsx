// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { FlatList, Platform, StyleSheet, View } from "react-native";
import { Text, TouchableRipple } from "react-native-paper";
import { useDispatch, useSelector } from "react-redux";
import * as Etebase from "etebase";

import { StoreState } from "../store";
import { performSync, setSettings } from "../store/actions";
import { SyncManager } from "../sync/SyncManager";
import { useCredentials } from "../credentials";
import { usePendingCount, useSyncGate } from "../SyncGate";
import { defaultColor } from "../helpers";
import { untitled } from "../notes";
import { useNoteSearch } from "../search";
import { fonts, useTheme } from "../theme";
import Link from "../widgets/Link";
import AppbarButton from "../widgets/AppbarButton";
import { Result } from "../screens/SearchScreen";
import { Entry, getSortFunction, shortDate, useNotePreview } from "./NoteList";
import { useSearchQuery, useWideNavigation } from "./WideLayout";

interface RowPropsType {
  item: Entry;
  itemMgr: Etebase.ItemManager | undefined;
  notebookName: string;
  color: string;
  selected: boolean;
  onOpen: () => void;
  // What the note matched when searching, to show instead of its beginning
  snippet?: React.ReactNode;
}

const NoteRow = React.memo(function NoteRow(props: RowPropsType) {
  const { item, itemMgr, notebookName, color, selected, onOpen, snippet } = props;
  const theme = useTheme();
  const preview = useNotePreview(itemMgr, item.cache);
  const mtime = item.meta.mtime;

  return (
    <Link
      to={`/notebook/${item.colUid}/note/${item.uid}`}
      // The note is opened next to the columns, replacing the one that is open
      action={{ type: "NOOP" } as any}
      onPress={onOpen}
      renderChild={(linkProps) => (
        <TouchableRipple
          {...linkProps}
          accessibilityLabel={item.meta.name || untitled}
          accessibilityState={{ selected }}
          aria-selected={selected}
          style={[styles.row, (selected)
            ? { backgroundColor: theme.colors.accentTint, borderColor: theme.colors.accentRing }
            : { borderColor: "transparent", borderBottomColor: theme.colors.divider }]}
        >
          <View>
            <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>{item.meta.name || untitled}</Text>
            {(snippet || preview) ? (
              <Text style={[styles.preview, { color: theme.colors.textSecondary }]} numberOfLines={2}>{snippet ?? preview}</Text>
            ) : null}
            <View style={styles.meta}>
              <View style={[styles.color, { backgroundColor: color }]} />
              <Text style={[styles.small, { color: theme.colors.textMuted }]} numberOfLines={1}>
                {notebookName}{(mtime) ? ` · ${shortDate(mtime)}` : ""}
              </Text>
            </View>
          </View>
        </TouchableRipple>
      )}
    />
  );
});

// Syncs when the column is shown, and every few minutes on the web. Not while the screen after
// logging in is open, which syncs for itself first (and would think there are no notebooks yet).
function useAutoSync(currentScreen: string | undefined) {
  const etebase = useCredentials();
  const dispatch = useDispatch();
  const paused = !currentScreen || ["AccountWizard", "Login", "Signup"].includes(currentScreen);

  const sync = React.useCallback(() => {
    if (etebase) {
      dispatch(performSync(SyncManager.getManager(etebase).sync()) as any); // not awaiting on purpose
    }
  }, [etebase]);

  React.useEffect(() => {
    if (paused) {
      return undefined;
    }
    sync();
    if (Platform.OS !== "web") {
      return undefined;
    }
    const id = setInterval(() => {
      if (navigator.onLine) {
        sync();
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [sync, paused]);

  return sync;
}

// The second column on wide screens: the notes of the chosen notebook (or all of them), or what
// was searched for
export default function NotesColumn() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const etebase = useCredentials();
  const syncGate = useSyncGate();
  const { currentNote, currentScreen, filterBy, navigate, openNote } = useWideNavigation();
  const { query } = useSearchQuery();
  const searching = query.trim() !== "";
  const cacheCollections = useSelector((state: StoreState) => state.cache.collections);
  const cacheItems = useSelector((state: StoreState) => state.cache.items);
  const viewSettings = useSelector((state: StoreState) => state.settings.viewSettings);
  const isSyncing = useSelector((state: StoreState) => state.syncCount) > 0;
  const pendingCount = usePendingCount();
  const results = useNoteSearch(query, searching && !syncGate);
  const sync = useAutoSync(currentScreen);

  // The item managers the rows load their previews with, created as needed
  const itemMgrs = React.useMemo(() => new Map<string, Etebase.ItemManager>(), [etebase, cacheCollections]);
  function getItemMgr(colUid: string) {
    const cached = cacheCollections.get(colUid);
    if (!itemMgrs.has(colUid) && etebase && cached) {
      const colMgr = etebase.getCollectionManager();
      itemMgrs.set(colUid, colMgr.getItemManager(colMgr.cacheLoad(cached.cache)));
    }
    return itemMgrs.get(colUid);
  }

  const entries: (Entry & { snippet?: React.ReactNode })[] = React.useMemo(() => {
    if (searching) {
      const ret = [];
      for (const result of results) {
        const [colUid, uid] = result.id.split(":");
        const item = cacheItems.get(colUid)?.get(uid);
        if (item && !item.isDeleted) {
          const contentMatches = result.terms.filter((term) => result.match[term].includes("content"));
          ret.push({
            ...item, colUid, uid,
            snippet: (contentMatches.length > 0) ? <Result text={result.content} search={query} matches={contentMatches} /> : undefined,
          });
        }
      }
      return ret;
    }
    const ret: Entry[] = [];
    for (const [colUid, items] of cacheItems.entries()) {
      if (filterBy && (colUid !== filterBy)) {
        continue;
      }
      for (const [uid, item] of items.entries()) {
        if (!item.isDeleted) {
          ret.push({ ...item, uid, colUid });
        }
      }
    }
    return ret.sort(getSortFunction(viewSettings.sortBy));
  }, [searching, results, cacheItems, filterBy, viewSettings.sortBy]);

  const byName = (viewSettings.sortBy === "name");
  const title = (searching) ? "Search" : (filterBy) ? (cacheCollections.get(filterBy)?.meta.name ?? "") : "All notes";
  const subtitle = (searching)
    ? `${entries.length} ${(entries.length === 1) ? "note matches" : "notes match"} “${query.trim()}”`
    : `${entries.length} ${(entries.length === 1) ? "note" : "notes"}`;

  return (
    <View testID="notes-column" style={[styles.column, { backgroundColor: theme.colors.background, borderRightColor: theme.colors.border }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.heading, { color: theme.colors.text }]} accessibilityRole="header" numberOfLines={1}>{title}</Text>
          <Text style={[styles.small, { color: theme.colors.textMuted }]} numberOfLines={1}>{subtitle}</Text>
        </View>
        <AppbarButton
          icon={(pendingCount > 0) ? "cloud-upload-outline" : "sync"}
          title={(pendingCount > 0) ? `Sync (${pendingCount} not uploaded yet)` : "Sync"}
          disabled={isSyncing}
          onPress={sync}
        />
        {!searching && (
          <AppbarButton
            icon={(byName) ? "sort-alphabetical-ascending" : "sort-clock-descending-outline"}
            title={(byName) ? "Sorted by name, sort by modification time" : "Sorted by modification time, sort by name"}
            disabled={isSyncing}
            onPress={() => dispatch(setSettings({ viewSettings: { ...viewSettings, sortBy: (byName) ? "mtime" : "name" } }) as any)}
          />
        )}
        {(filterBy && !searching) && (
          <AppbarButton
            icon="notebook-edit-outline"
            title="Manage Notebook"
            disabled={isSyncing}
            onPress={() => navigate("CollectionChangelog", { colUid: filterBy })}
          />
        )}
      </View>
      {(syncGate) ? syncGate : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          data={entries}
          keyExtractor={(item) => `${item.colUid}/${item.uid}`}
          maxToRenderPerBatch={10}
          renderItem={({ item }) => {
            const collection = cacheCollections.get(item.colUid);
            return (
              <NoteRow
                item={item}
                itemMgr={getItemMgr(item.colUid)}
                notebookName={collection?.meta.name ?? ""}
                color={collection?.meta.color || defaultColor}
                selected={currentNote === `${item.colUid}/${item.uid}`}
                onOpen={() => openNote(item.colUid, item.uid)}
                snippet={item.snippet}
              />
            );
          }}
          ListEmptyComponent={() => (
            <Text style={[styles.empty, { color: theme.colors.textMuted }]}>
              {(searching) ? `No notes match “${query.trim()}”` : (filterBy) ? "Notebook is empty" : "No notes yet"}
            </Text>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    width: 340,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    paddingRight: 6,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  heading: {
    fontFamily: fonts.semibold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  list: {
    paddingHorizontal: 10,
    paddingBottom: 16,
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 2,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  preview: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },
  color: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: 8,
  },
  small: {
    fontSize: 12,
    flexShrink: 1,
  },
  empty: {
    padding: 12,
    fontSize: 14,
  },
});
