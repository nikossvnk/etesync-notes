// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { FlatList, Linking, Platform, Share, StyleSheet, TextInput, View } from "react-native";
import { FAB, Snackbar, Text, TouchableRipple } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import * as Clipboard from "expo-clipboard";

import { useSyncGate, usePendingCount } from "../SyncGate";
import { StoreState } from "../store";
import { bookmarksSelector } from "../store/selectors";
import { performSync, pushMessage } from "../store/actions";
import { SyncManager } from "../sync/SyncManager";
import { useCredentials } from "../credentials";
import { Bookmark, bookmarksFrom, allTags, bookmarkTitle, deleteBookmark, domainOf, restoreBookmark } from "../bookmarks";
import { shortDate } from "../components/NoteList";

import Appbar from "../widgets/Appbar";
import AppbarButton from "../widgets/AppbarButton";
import BottomSheet from "../widgets/BottomSheet";
import GroupedRow from "../widgets/GroupedRow";
import SectionTabs from "../widgets/SectionTabs";
import { fonts, useTheme } from "../theme";

// The colors of the tiles with the first letter of a site (a site always gets the same one)
const tileColors = ["#5B7FE0", "#2F9E7A", "#C9822F", "#9A6BD6", "#D2607A", "#3E9AB8", "#8A8C33"];

function tileColor(domain: string) {
  let hash = 0;
  for (let i = 0 ; i < domain.length ; i++) {
    hash = ((hash * 31) + domain.charCodeAt(i)) | 0;
  }
  return tileColors[Math.abs(hash) % tileColors.length];
}

// The letter of a site: "en.wikipedia.org" is W
function tileLetter(domain: string) {
  const parts = domain.split(".");
  const name = (parts.length > 2) ? parts[parts.length - 2] : parts[0];
  return (name?.[0] ?? "?").toUpperCase();
}

export function SiteTile(props: { url: string, size?: number }) {
  const domain = domainOf(props.url);
  const color = tileColor(domain);
  const size = props.size ?? 40;
  return (
    <View aria-hidden style={[styles.tile, { width: size, height: size, backgroundColor: color + "29" }]}>
      <Text style={[styles.tileLetter, { color, fontSize: size * 0.42 }]}>{tileLetter(domain)}</Text>
    </View>
  );
}

const ALL = "";
const UNTAGGED = "\u0000untagged";

export function openLink(url: string) {
  Linking.openURL(url).catch(() => undefined);
}

export default function BookmarkListScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const theme = useTheme();
  const syncGate = useSyncGate();
  const etebase = useCredentials();
  const bookmarkItems = useSelector(bookmarksSelector);
  const bookmarks = React.useMemo(() => bookmarksFrom(bookmarkItems), [bookmarkItems]);
  const [query, setQuery] = React.useState("");
  const [tag, setTag] = React.useState(ALL);
  const [menuFor, setMenuFor] = React.useState<Bookmark>();
  const [deleted, setDeleted] = React.useState<Bookmark>();

  React.useEffect(() => {
    navigation.setOptions({
      header: (props: any) => <Appbar {...props} menuFallback />,
      title: "Bookmarks",
      headerTitle: () => <View style={{ flex: 1 }} />,
      headerShadowVisible: false,
      headerRight: () => <SyncButton />,
    });
  }, [navigation]);

  const tags = React.useMemo(() => allTags(bookmarks), [bookmarks]);
  const hasUntagged = bookmarks.some((x) => x.tags.length === 0);
  // The chosen tag may be gone (e.g. its last bookmark was deleted)
  const filterTag = ((tag === ALL) || (tag === UNTAGGED) || tags.includes(tag)) ? tag : ALL;

  const shown = React.useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter((x) => x !== "");
    return bookmarks.filter((bookmark) => {
      if ((filterTag === UNTAGGED) ? (bookmark.tags.length > 0) : ((filterTag !== ALL) && !bookmark.tags.includes(filterTag))) {
        return false;
      }
      const text = [bookmark.title, bookmark.url, bookmark.note, ...bookmark.tags.map((x) => "#" + x)].join(" ").toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [bookmarks, query, filterTag]);

  if (syncGate) {
    return syncGate;
  }

  async function remove(bookmark: Bookmark) {
    setMenuFor(undefined);
    await deleteBookmark(etebase!, bookmark);
    setDeleted(bookmark);
  }

  async function undo() {
    const bookmark = deleted;
    setDeleted(undefined);
    if (bookmark) {
      await restoreBookmark(etebase!, bookmark);
    }
  }

  async function copy(bookmark: Bookmark) {
    setMenuFor(undefined);
    await Clipboard.setStringAsync(bookmark.url);
    dispatch(pushMessage({ message: "Link copied", severity: "success" }) as any);
  }

  function share(bookmark: Bookmark) {
    setMenuFor(undefined);
    if ((Platform.OS === "web") && !navigator.share) {
      copy(bookmark);
      return;
    }
    Share.share({ message: bookmark.url, url: bookmark.url, title: bookmarkTitle(bookmark) }).catch(() => undefined);
  }

  const header = (
    <View style={styles.header}>
      <SectionTabs current="bookmarks" count={bookmarks.length} />
      <Text style={[styles.bigTitle, { color: theme.colors.text }]} accessibilityRole="header">Bookmarks</Text>
      {(bookmarks.length > 0) && (
        <View style={[styles.search, { backgroundColor: theme.colors.field }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search titles, links, notes"
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel="Search bookmarks"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
          {(query !== "") && (
            <TouchableRipple borderless onPress={() => setQuery("")} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clear}>
              <MaterialCommunityIcons name="close" size={18} color={theme.colors.textMuted} />
            </TouchableRipple>
          )}
        </View>
      )}
      {(tags.length > 0) && (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.chips}
          contentContainerStyle={styles.chipsContent}
          data={[ALL, ...tags, ...((hasUntagged) ? [UNTAGGED] : [])]}
          keyExtractor={(x) => x || "all"}
          renderItem={({ item }) => (
            <TagChip
              label={(item === ALL) ? "All" : (item === UNTAGGED) ? "Untagged" : `#${item}`}
              selected={item === filterTag}
              onPress={() => setTag(item)}
            />
          )}
        />
      )}
    </View>
  );

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        data={shown}
        keyExtractor={(x) => `${x.colUid}/${x.uid}`}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <BookmarkRow
            bookmark={item}
            first={index === 0}
            last={index === shown.length - 1}
            onMenu={() => setMenuFor(item)}
          />
        )}
        ListEmptyComponent={(bookmarks.length === 0) ? (
          <EmptyBookmarks onAdd={() => navigation.navigate("BookmarkCreate")} />
        ) : (
          <Text style={[styles.none, { color: theme.colors.textMuted }]}>
            {(query !== "") ? "No bookmarks match the search." : "No bookmarks with this tag."}
          </Text>
        )}
      />

      <FAB
        icon="plus"
        label="Add"
        uppercase={false}
        accessibilityLabel="Add bookmark"
        color={theme.colors.onAccent}
        style={[styles.fab, { backgroundColor: theme.colors.accent }, (deleted) && styles.fabRaised]}
        onPress={() => navigation.navigate("BookmarkCreate")}
      />

      <BottomSheet visible={!!menuFor} onDismiss={() => setMenuFor(undefined)} label={(menuFor) ? bookmarkTitle(menuFor) : ""} role="menu">
        {menuFor && (
          <>
            <View style={[styles.sheetHead, { borderBottomColor: theme.colors.divider }]}>
              <SiteTile url={menuFor.url} />
              <View style={styles.sheetHeadText}>
                <Text style={[styles.rowTitle, { color: theme.colors.text }]} numberOfLines={1}>{bookmarkTitle(menuFor)}</Text>
                <Text style={[styles.rowSmall, { color: theme.colors.textMuted }]} numberOfLines={1}>{menuFor.url}</Text>
              </View>
            </View>
            <SheetItem icon="open-in-new" label="Open in browser" onPress={() => {
              setMenuFor(undefined); openLink(menuFor.url);
            }} />
            <SheetItem icon="content-copy" label="Copy link" onPress={() => copy(menuFor)} />
            <SheetItem icon="share-variant-outline" label="Share…" onPress={() => share(menuFor)} />
            <SheetItem icon="pencil-outline" label="Edit" onPress={() => {
              setMenuFor(undefined);
              navigation.navigate("BookmarkEdit", { colUid: menuFor.colUid, itemUid: menuFor.uid });
            }} />
            <SheetItem icon="delete-outline" label="Delete" danger onPress={() => remove(menuFor)} />
          </>
        )}
      </BottomSheet>

      <Snackbar
        visible={!!deleted}
        onDismiss={() => setDeleted(undefined)}
        duration={8000}
        wrapperStyle={{ zIndex: 5 }}
        style={{ backgroundColor: theme.colors.chipActive }}
        action={{ label: "Undo", onPress: undo, textColor: (theme.dark) ? theme.colors.accent : "#A8BDF7" }}
      >
        <Text style={{ color: theme.colors.onChipActive }}>Bookmark deleted</Text>
      </Snackbar>
    </>
  );
}

function SyncButton() {
  const etebase = useCredentials();
  const dispatch = useDispatch();
  const isSyncing = useSelector((state: StoreState) => state.syncCount) > 0;
  const pendingCount = usePendingCount();

  const refresh = React.useCallback(() => {
    if (etebase) {
      dispatch(performSync(SyncManager.getManager(etebase).sync()) as any);
    }
  }, [etebase]);
  useFocusEffect(refresh);

  return (
    <AppbarButton
      icon={(pendingCount > 0) ? "cloud-upload-outline" : "sync"}
      title={(pendingCount > 0) ? `Sync (${pendingCount} not uploaded yet)` : "Sync"}
      disabled={isSyncing}
      onPress={refresh}
    />
  );
}

function TagChip(props: { label: string, selected: boolean, onPress: () => void }) {
  const theme = useTheme();
  const { label, selected, onPress } = props;
  return (
    <TouchableRipple
      borderless
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, {
        backgroundColor: (selected) ? theme.colors.chipActive : theme.colors.surface,
        borderColor: (selected) ? theme.colors.chipActive : theme.colors.border,
      }]}
    >
      <Text style={[styles.chipLabel, { color: (selected) ? theme.colors.onChipActive : theme.colors.text }, (selected) && { fontFamily: fonts.medium }]}>{label}</Text>
    </TouchableRipple>
  );
}

const BookmarkRow = React.memo(function BookmarkRow(props: { bookmark: Bookmark, first: boolean, last: boolean, onMenu: () => void }) {
  const theme = useTheme();
  const { bookmark, first, last, onMenu } = props;
  const title = bookmarkTitle(bookmark);

  return (
    <GroupedRow
      first={first}
      last={last}
      onPress={() => openLink(bookmark.url)}
      onLongPress={onMenu}
      accessibilityRole="link"
      accessibilityLabel={title}
      accessibilityHint={`Opens ${domainOf(bookmark.url)}`}
      style={styles.row}
    >
      <View style={styles.rowInner}>
        <SiteTile url={bookmark.url} />
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: theme.colors.text }]} numberOfLines={2}>{title}</Text>
          <Text style={[styles.rowSmall, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {domainOf(bookmark.url)}{"  ·  "}{shortDate(bookmark.created)}
          </Text>
          {(bookmark.note !== "") && (
            <Text style={[styles.rowNote, { color: theme.colors.textSecondary }]} numberOfLines={1}>{bookmark.note}</Text>
          )}
          {(bookmark.tags.length > 0) && (
            <View style={styles.rowTags}>
              {bookmark.tags.map((tag) => (
                <Text key={tag} style={[styles.rowTag, { backgroundColor: theme.colors.field, color: theme.colors.textSecondary }]}>#{tag}</Text>
              ))}
            </View>
          )}
        </View>
        <TouchableRipple
          borderless
          onPress={onMenu}
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${title}`}
          aria-haspopup="menu"
          style={styles.more}
        >
          <MaterialCommunityIcons name="dots-vertical" size={20} color={theme.colors.textMuted} />
        </TouchableRipple>
      </View>
    </GroupedRow>
  );
});

function SheetItem(props: { icon: string, label: string, onPress: () => void, danger?: boolean }) {
  const theme = useTheme();
  const color = (props.danger) ? theme.colors.error : theme.colors.text;
  return (
    <TouchableRipple borderless role="menuitem" accessibilityLabel={props.label} onPress={props.onPress} style={styles.sheetItem}>
      <View style={styles.sheetItemInner}>
        <MaterialCommunityIcons name={props.icon as any} size={21} color={(props.danger) ? color : theme.colors.textSecondary} />
        <Text style={[styles.sheetItemLabel, { color }]}>{props.label}</Text>
      </View>
    </TouchableRipple>
  );
}

function EmptyBookmarks(props: { onAdd: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.colors.accentTint }]}>
        <MaterialCommunityIcons name="bookmark-outline" size={34} color={theme.colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Keep links for later</Text>
      <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
        {(Platform.OS === "android") ?
          "Add a link here, or share a page from your browser to EteSync Notes. Bookmarks sync to your other devices, encrypted." :
          "Add a link here. Bookmarks sync to your other devices, encrypted."}
      </Text>
      <TouchableRipple borderless onPress={props.onAdd} accessibilityRole="button" style={[styles.emptyButton, { backgroundColor: theme.colors.accent }]}>
        <View style={styles.emptyButtonInner}>
          <MaterialCommunityIcons name="plus" size={20} color={theme.colors.onAccent} />
          <Text style={[styles.emptyButtonText, { color: theme.colors.onAccent }]}>Add a bookmark</Text>
        </View>
      </TouchableRipple>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: 16,
    // Leave room for the button that's floating over the list
    paddingBottom: 112,
  },
  header: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 12,
  },
  bigTitle: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.6,
    marginBottom: 12,
  },
  search: {
    height: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 4,
  },
  searchInput: {
    flex: 1,
    height: 44,
    marginLeft: 10,
    fontSize: 15,
    fontFamily: fonts.regular,
    outlineStyle: "none",
  } as any,
  clear: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: {
    marginTop: 12,
    marginHorizontal: -20,
  },
  chipsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: "center",
  },
  chipLabel: {
    fontSize: 13,
  },
  row: {
    paddingLeft: 12,
    paddingRight: 2,
    paddingVertical: 12,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  tile: {
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLetter: {
    fontFamily: fonts.bold,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
  },
  rowSmall: {
    fontSize: 12,
  },
  rowNote: {
    fontSize: 13,
  },
  rowTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  rowTag: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  more: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -2,
  },
  none: {
    textAlign: "center",
    marginTop: 40,
    marginHorizontal: 24,
  },
  fab: {
    position: "absolute",
    margin: 20,
    right: 0,
    bottom: 0,
    borderRadius: 18,
  },
  fabRaised: {
    bottom: 64,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingBottom: 14,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetHeadText: {
    flex: 1,
    minWidth: 0,
  },
  sheetItem: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
  },
  sheetItemInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 14,
  },
  sheetItemLabel: {
    fontSize: 15,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: fonts.semibold,
    fontSize: 22,
    lineHeight: 30,
    textAlign: "center",
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: 22,
    height: 50,
    borderRadius: 14,
  },
  emptyButtonInner: {
    height: 50,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
});
