import * as React from "react";
import { format } from "date-fns";
import { FlatList, StyleSheet, View, useWindowDimensions } from "react-native";
import { Card, List, Text } from "react-native-paper";
import { useSelector } from "react-redux";
import * as Etebase from "etebase";

import { useSyncGate } from "../SyncGate";
import { useCredentials } from "../credentials";
import { CachedItem, StoreState } from "../store";
import { defaultColor } from "../helpers";
import { untitled } from "../notes";

import NotFound from "../widgets/NotFound";
import Link from "../widgets/Link";
import { useTheme } from "../theme";

function sortMtime(aIn: CachedItem, bIn: CachedItem) {
  const a = aIn.meta.mtime!;
  const b = bIn.meta.mtime!;
  return (a > b) ? -1 : (a < b) ? 1 : 0;
}

function sortName(aIn: CachedItem, bIn: CachedItem) {
  const a = aIn.meta.name!;
  const b = bIn.meta.name!;
  return a.localeCompare(b);
}

export function getSortFunction(sortOrder: string) {
  const sortFunctions: (typeof sortName)[] = [];

  switch (sortOrder) {
    case "mtime":
      // Do nothing because it's the last sort function anyway
      break;
    case "name":
      sortFunctions.push(sortName);
      break;
  }

  sortFunctions.push(sortMtime);

  return (a: CachedItem, b: CachedItem) => {
    for (const sortFunction of sortFunctions) {
      const ret = sortFunction(a, b);
      if (ret !== 0) {
        return ret;
      }
    }

    return 0;
  };
}

type Entry = CachedItem & { colUid: string, uid: string };

// The previews of the notes, by the cache they were made from
const previews = new WeakMap<Uint8Array, string>();

// The beginning of a note as plain text, without most of the markdown formatting
function toPreview(content: string) {
  return content.substring(0, 400)
    .replace(/^\s*[-*+] \[ \]/gm, "☐")
    .replace(/^\s*[-*+] \[x\]/gim, "☑")
    .replace(/^\s*[-*+] /gm, "• ")
    .replace(/^\s*(#{1,6}|>)\s*/gm, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

function useNotePreview(itemMgr: Etebase.ItemManager | undefined, cache: Uint8Array) {
  const [preview, setPreview] = React.useState(previews.get(cache));

  React.useEffect(() => {
    const known = previews.get(cache);
    if ((known !== undefined) || !itemMgr) {
      setPreview(known);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const content = await itemMgr.cacheLoad(cache).getContent(Etebase.OutputFormat.String);
      const ret = toPreview(content);
      previews.set(cache, ret);
      if (!cancelled) {
        setPreview(ret);
      }
    })().catch(() => {
      // The note just has no preview then
    });
    return () => {
      cancelled = true;
    };
  }, [itemMgr, cache]);

  return preview;
}

interface NoteCardPropsType {
  item: Entry;
  itemMgr: Etebase.ItemManager | undefined;
  color: string;
  // Only passed when notes of more than one notebook are listed
  notebookName?: string;
}

const NoteCard = React.memo(function NoteCard(props: NoteCardPropsType) {
  const { item, itemMgr, color, notebookName } = props;
  const preview = useNotePreview(itemMgr, item.cache);
  const mtime = item.meta.mtime;

  return (
    <Link
      to={`/notebook/${item.colUid}/note/${item.uid}`}
      renderChild={(props) => (
        <Card
          {...props}
          style={styles.card}
          accessibilityLabel={item.meta.name || untitled}
        >
          <View style={styles.cardInner}>
            <View style={[styles.cardColor, { backgroundColor: color }]} />
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.meta.name || untitled}</Text>
              <Text style={styles.cardPreview} numberOfLines={4}>{preview}</Text>
              <View style={styles.cardFooter}>
                {/* The time moves to a second line when it doesn't fit next to the date */}
                <View style={styles.cardDate}>
                  {mtime && (
                    <>
                      <Text style={styles.cardSmall}>{format(mtime, "PP")} </Text>
                      <Text style={styles.cardSmall}>{format(mtime, "p")}</Text>
                    </>
                  )}
                </View>
                {notebookName && (
                  <Text style={[styles.cardSmall, styles.cardNotebook]} numberOfLines={1}>{notebookName}</Text>
                )}
              </View>
            </View>
          </View>
        </Card>
      )}
    />
  );
});

interface PropsType {
  colUid?: string;
  sortBy: "name" | "mtime";
}

export default function NoteList(props: PropsType) {
  const cacheCollections = useSelector((state: StoreState) => state.cache.collections);
  const cacheItems = useSelector((state: StoreState) => state.cache.items);
  const syncGate = useSyncGate();
  const theme = useTheme();
  const etebase = useCredentials();
  // The width of the list itself, which is less than the window's next to the sidebar
  const windowWidth = useWindowDimensions().width;
  const [listWidth, setListWidth] = React.useState<number>();
  const width = listWidth ?? windowWidth;
  const numColumns = Math.min(Math.max(Math.floor(width / 200), 2), 6);

  // The item managers the cards load their previews with, created as needed
  const itemMgrs = React.useMemo(() => new Map<string, Etebase.ItemManager>(), [etebase, cacheCollections]);
  function getItemMgr(colUid: string) {
    const cached = cacheCollections.get(colUid);
    if (!itemMgrs.has(colUid) && etebase && cached) {
      const colMgr = etebase.getCollectionManager();
      itemMgrs.set(colUid, colMgr.getItemManager(colMgr.cacheLoad(cached.cache)));
    }
    return itemMgrs.get(colUid);
  }

  const { sortBy } = props;
  const colUid = props.colUid || undefined;
  const cacheCollection = (colUid) ? cacheCollections.get(colUid) : undefined;

  const entriesList = React.useMemo(() => {
    const filterByUid = colUid;

    const ret: Entry[] = [];
    for (const [colUid, itemLists] of cacheItems.entries()) {
      if (filterByUid && (filterByUid !== colUid)) {
        continue;
      }

      for (const [uid, item] of itemLists.entries()) {
        if (item.isDeleted) {
          continue;
        }

        ret.push({ ...item, uid, colUid });
      }
    }
    return ret.sort(getSortFunction(sortBy));
  }, [cacheItems, sortBy, colUid]);

  if (syncGate) {
    return syncGate;
  }

  if (colUid && !cacheCollection) {
    return <NotFound />;
  }

  function renderEntry(param: { item: Entry }) {
    const item = param.item;
    const collection = cacheCollections.get(item.colUid);

    return (
      <View style={[styles.cell, { maxWidth: `${100 / numColumns}%` }]}>
        <NoteCard
          item={item}
          itemMgr={getItemMgr(item.colUid)}
          color={collection?.meta.color || defaultColor}
          notebookName={(colUid) ? undefined : collection?.meta.name}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={[{ backgroundColor: theme.colors.background }, { flex: 1 }]}
      contentContainerStyle={styles.list}
      // Changing the number of columns on the fly is not supported
      key={numColumns}
      numColumns={numColumns}
      onLayout={(e) => setListWidth(e.nativeEvent.layout.width)}
      data={entriesList}
      keyExtractor={(item) => item.uid}
      renderItem={renderEntry}
      maxToRenderPerBatch={10}
      ListEmptyComponent={() => (
        <List.Item
          title="Notebook is empty"
        />
      )}
    />
  );
}

const cardHeight = 184;

const styles = StyleSheet.create({
  list: {
    padding: 6,
    // Leave room for the button that's floating over the list
    paddingBottom: 88,
  },
  cell: {
    flex: 1,
    padding: 6,
  },
  card: {
    height: cardHeight,
    borderRadius: 10,
  },
  cardInner: {
    height: cardHeight,
    borderRadius: 10,
    overflow: "hidden",
  },
  cardColor: {
    height: 5,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  cardPreview: {
    flex: 1,
    overflow: "hidden",
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.7,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: 6,
  },
  cardDate: {
    flexDirection: "row",
    flexWrap: "wrap",
    flexShrink: 1,
  },
  cardSmall: {
    fontSize: 11,
    opacity: 0.55,
  },
  cardNotebook: {
    maxWidth: "50%",
    marginLeft: 8,
  },
});
