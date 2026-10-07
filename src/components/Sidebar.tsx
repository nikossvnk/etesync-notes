// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { PanResponder, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { IconButton, Text, TouchableRipple } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NavigationState, StackActions, useNavigation, useNavigationState } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";

import { StoreState } from "../store";
import { setSettings } from "../store/actions";
import { defaultColor, useDeviceBreakpoint } from "../helpers";
import { cardShadow, fonts, useTheme } from "../theme";
import { usePendingCount } from "../SyncGate";
import { getSortFunction } from "./NoteList";
import { untitled } from "../notes";

// The sidebar's width can be changed between these, and always leaves room for the screen next to it
const minWidth = 200;
const maxWidth = 600;
const minScreenWidth = 400;

function clampWidth(width: number, windowWidth: number) {
  return Math.round(Math.max(minWidth, Math.min(width, maxWidth, windowWidth - minScreenWidth)));
}

// Changes the width of the sidebar by dragging the handle on its edge. The width is shown while
// dragging and saved when it's let go.
function useResize(savedWidth: number, save: (width: number) => void) {
  const windowWidth = useWindowDimensions().width;
  const [dragWidth, setDragWidth] = React.useState<number>();
  const startRef = React.useRef(savedWidth);
  const latest = React.useRef({ savedWidth, windowWidth, save });
  latest.current = { savedWidth, windowWidth, save };

  const panResponder = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      startRef.current = clampWidth(latest.current.savedWidth, latest.current.windowWidth);
      setDragWidth(startRef.current);
    },
    onPanResponderMove: (_e, gesture) => {
      setDragWidth(clampWidth(startRef.current + gesture.dx, latest.current.windowWidth));
    },
    onPanResponderRelease: (_e, gesture) => {
      latest.current.save(clampWidth(startRef.current + gesture.dx, latest.current.windowWidth));
      setDragWidth(undefined);
    },
    onPanResponderTerminate: () => setDragWidth(undefined),
  }), []);

  return {
    width: dragWidth ?? clampWidth(savedWidth, windowWidth),
    dragging: dragWidth !== undefined,
    handlers: panResponder.panHandlers,
  };
}

// Whether the screens have the sidebar next to them: on wide screens, unless it was hidden
export function useSidebarShown() {
  const wide = useDeviceBreakpoint("tabletLandscape");
  const sidebarVisible = useSelector((state: StoreState) => state.settings.sidebarVisible);
  return wide && sidebarVisible;
}

// The screens that belong to a note, so that it's shown as the current one in the tree
const noteScreens = ["NoteEdit"];

// The state of the stack with the screens, which is inside of the drawer
function useStackState() {
  return useNavigationState((state: NavigationState) => {
    const root = state.routes.find((x) => x.name === "Root");
    return root?.state as NavigationState | undefined;
  });
}

// The notebooks that the user closed in the tree, kept while the app is open
const collapsedNotebooks = new Set<string>();

interface RowPropsType {
  label: string;
  accessibilityLabel: string;
  selected?: boolean;
  indent?: number;
  onPress: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  dim?: boolean;
}

function Row(props: RowPropsType) {
  const theme = useTheme();
  const { label, accessibilityLabel, selected, indent = 0, onPress, left, right, dim } = props;

  return (
    <TouchableRipple
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!selected }}
      // The web doesn't get the state above for buttons
      aria-selected={!!selected}
      style={[styles.row, { paddingLeft: 6 + indent * 20 }, (selected) ? [{ backgroundColor: theme.colors.surface }, cardShadow] : undefined]}
    >
      <View style={styles.rowContent}>
        {left}
        <Text
          numberOfLines={1}
          style={[styles.rowLabel, { color: (selected) ? theme.colors.text : theme.colors.textBody },
            (selected) ? { fontFamily: fonts.medium } : undefined, (dim) ? styles.dim : undefined]}
        >
          {label}
        </Text>
        {right}
      </View>
    </TouchableRipple>
  );
}

// A tree of the notebooks and their notes, next to the screens on wide screens
export default function Sidebar() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const stackState = useStackState();
  const cacheCollections = useSelector((state: StoreState) => state.cache.collections);
  const cacheItems = useSelector((state: StoreState) => state.cache.items);
  const viewSettings = useSelector((state: StoreState) => state.settings.viewSettings);
  const savedWidth = useSelector((state: StoreState) => state.settings.sidebarWidth);
  const resize = useResize(savedWidth, (sidebarWidth) => dispatch(setSettings({ sidebarWidth }) as any));
  const [filter, setFilter] = React.useState("");
  // Changing the set doesn't re-render, so this does
  const [, setCollapsedVersion] = React.useState(0);

  const current = stackState?.routes[stackState.index];
  const currentParams: any = current?.params ?? {};
  const currentNote = (current && noteScreens.includes(current.name)) ? `${currentParams.colUid}/${currentParams.itemUid}` : undefined;
  // The notebook whose notes are listed on the main screen
  const listing = (current?.name === "Home") || (current?.name === "Collection");
  const filterBy = (viewSettings.filterBy && cacheCollections.has(viewSettings.filterBy)) ? viewSettings.filterBy : undefined;

  const notebooks = React.useMemo(() => {
    const sortFunction = getSortFunction(viewSettings.sortBy);
    const search = filter.trim().toLowerCase();
    return Array.from(cacheCollections.entries())
      .map(([colUid, collection]) => {
        const notes = Array.from(cacheItems.get(colUid)?.entries() ?? [])
          .filter(([_uid, item]) => !item.isDeleted)
          .sort(([_a, a], [_b, b]) => sortFunction(a, b));
        return {
          colUid,
          name: collection.meta.name ?? "",
          color: collection.meta.color || defaultColor,
          count: notes.length,
          notes: (search) ? notes.filter(([_uid, item]) => (item.meta.name ?? "").toLowerCase().includes(search)) : notes,
        };
      })
      .filter((notebook) => !search || (notebook.notes.length > 0) || notebook.name.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cacheCollections, cacheItems, viewSettings.sortBy, filter]);

  // The notebook of the note that is opened is always open in the tree
  React.useEffect(() => {
    if (currentNote) {
      const colUid = currentNote.split("/")[0];
      if (collapsedNotebooks.delete(colUid)) {
        setCollapsedVersion((x) => x + 1);
      }
    }
  }, [currentNote]);

  function toggle(colUid: string) {
    if (!collapsedNotebooks.delete(colUid)) {
      collapsedNotebooks.add(colUid);
    }
    setCollapsedVersion((x) => x + 1);
  }

  function showList(colUid: string | undefined) {
    dispatch(setSettings({
      viewSettings: {
        ...viewSettings,
        filterBy: colUid ?? null,
      },
    }) as any);
    if (!listing) {
      navigation.navigate("Root", { screen: "Home", pop: true });
    }
  }

  function openNote(colUid: string, itemUid: string) {
    if (currentNote === `${colUid}/${itemUid}`) {
      return;
    }
    // Going from note to note replaces the note, so that the back button goes back to the list
    // (the stack replaces the screen the action comes from, which has to be passed as it's sent from outside of it)
    if (stackState && current && (current.name === "NoteEdit")) {
      navigation.dispatch({ ...StackActions.replace("NoteEdit", { colUid, itemUid }), source: current.key, target: stackState.key });
    } else {
      navigation.navigate("Root", { screen: "NoteEdit", params: { colUid, itemUid } });
    }
  }

  function setVisible(sidebarVisible: boolean) {
    dispatch(setSettings({ sidebarVisible }) as any);
  }

  const borderColor = theme.colors.border;
  const pendingCount = usePendingCount();
  const isSyncing = useSelector((state: StoreState) => state.syncCount) > 0;

  return (
    <View
      testID="sidebar"
      style={[styles.sidebar, { width: resize.width, backgroundColor: theme.colors.sidebar, borderRightColor: borderColor },
        // No text gets selected while dragging the edge
        (resize.dragging && (Platform.OS === "web")) ? ({ userSelect: "none" } as any) : undefined]}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Notebooks</Text>
        <IconButton
          containerColor="transparent"
          iconColor={theme.colors.textMuted}
          icon="notebook-plus-outline"
          size={20}
          accessibilityLabel="New notebook"
          onPress={() => navigation.navigate("Root", { screen: "CollectionCreate" })}
        />
        <IconButton
          containerColor="transparent"
          iconColor={theme.colors.textMuted}
          icon="chevron-double-left"
          size={20}
          accessibilityLabel="Hide the sidebar"
          onPress={() => setVisible(false)}
        />
      </View>
      <View style={[styles.search, { borderColor, backgroundColor: theme.colors.surface }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.inactiveIcon} />
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Find a note"
          placeholderTextColor={theme.colors.inactiveIcon}
          accessibilityLabel="Find a note"
          style={[styles.searchInput, { color: theme.colors.onSurface }]}
        />
        {(filter !== "") && (
          <IconButton containerColor="transparent" iconColor={theme.colors.textMuted} icon="close" size={16} style={styles.smallButton} accessibilityLabel="Clear" onPress={() => setFilter("")} />
        )}
      </View>
      <TouchableRipple
        borderless
        accessibilityRole="button"
        accessibilityLabel="New note"
        style={[styles.newNote, { backgroundColor: theme.colors.accent }]}
        onPress={() => navigation.navigate("Root", { screen: "NoteCreate", params: (filterBy) ? { colUid: filterBy } : undefined })}
      >
        <View style={styles.newNoteInner}>
          <MaterialCommunityIcons name="plus" size={18} color={theme.colors.onAccent} />
          <Text style={[styles.newNoteText, { color: theme.colors.onAccent }]}>New note</Text>
        </View>
      </TouchableRipple>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.tree}>
        {(filter === "") && (
          <Row
            label="All notes"
            accessibilityLabel="All notes"
            selected={listing && !filterBy}
            onPress={() => showList(undefined)}
            left={<MaterialCommunityIcons name="note-multiple-outline" size={18} color={theme.colors.inactiveIcon} style={styles.icon} />}
          />
        )}
        {notebooks.map((notebook) => {
          // Everything that matches is shown while searching
          const open = (filter !== "") || !collapsedNotebooks.has(notebook.colUid);
          return (
            <React.Fragment key={notebook.colUid}>
              <Row
                label={notebook.name}
                accessibilityLabel={`Notebook ${notebook.name}`}
                selected={listing && (filterBy === notebook.colUid)}
                onPress={() => showList(notebook.colUid)}
                left={(
                  <>
                    <IconButton
                      containerColor="transparent"
                      iconColor={theme.colors.textMuted}
                      icon={(open) ? "chevron-down" : "chevron-right"}
                      size={18}
                      style={styles.smallButton}
                      accessibilityLabel={(open) ? `Close ${notebook.name}` : `Open ${notebook.name}`}
                      onPress={() => toggle(notebook.colUid)}
                    />
                    <View style={[styles.color, { backgroundColor: notebook.color }]} />
                  </>
                )}
                right={(
                  <>
                    <Text style={[styles.count, { color: theme.colors.textMuted }]}>{notebook.count}</Text>
                    <IconButton
                      containerColor="transparent"
                      iconColor={theme.colors.textMuted}
                      icon="plus"
                      size={16}
                      style={styles.smallButton}
                      accessibilityLabel={`New note in ${notebook.name}`}
                      onPress={() => navigation.navigate("Root", { screen: "NoteCreate", params: { colUid: notebook.colUid } })}
                    />
                  </>
                )}
              />
              {open && notebook.notes.map(([itemUid, item]) => (
                <Row
                  key={itemUid}
                  label={item.meta.name || untitled}
                  accessibilityLabel={`Note ${item.meta.name || untitled}`}
                  indent={1}
                  selected={currentNote === `${notebook.colUid}/${itemUid}`}
                  onPress={() => openNote(notebook.colUid, itemUid)}
                  left={<MaterialCommunityIcons name="note-text-outline" size={16} color={theme.colors.inactiveIcon} style={styles.icon} />}
                />
              ))}
              {open && (notebook.notes.length === 0) && (filter === "") && (
                <Row label="No notes" accessibilityLabel={`No notes in ${notebook.name}`} indent={1} dim onPress={() => showList(notebook.colUid)} />
              )}
            </React.Fragment>
          );
        })}
        {(notebooks.length === 0) && (
          <Text style={[styles.empty, styles.dim]}>{(filter !== "") ? "No notes found" : "No notebooks yet"}</Text>
        )}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: borderColor }]}>
        <TouchableRipple
          borderless
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={styles.footerButton}
          onPress={() => navigation.navigate("Root", { screen: "Settings" })}
        >
          <View style={styles.rowContent}>
            <MaterialCommunityIcons name="cog-outline" size={18} color={theme.colors.textBody} style={styles.icon} />
            <Text style={[styles.rowLabel, { color: theme.colors.textBody }]}>Settings</Text>
          </View>
        </TouchableRipple>
        <View style={styles.syncState}>
          <View style={[styles.syncDot, { backgroundColor: (pendingCount > 0) ? theme.colors.disabled : theme.colors.success }]} />
          <Text style={[styles.count, { color: theme.colors.textMuted }]}>
            {(isSyncing) ? "Syncing…" : (pendingCount > 0) ? `${pendingCount} to sync` : "Synced"}
          </Text>
        </View>
      </View>
      <View
        {...resize.handlers}
        testID="sidebar-resize"
        accessibilityLabel="Change the width of the sidebar"
        style={[styles.resize, (Platform.OS === "web") ? ({ cursor: "col-resize" } as any) : undefined,
          (resize.dragging) ? { backgroundColor: theme.colors.activeIcon } : undefined]}
      />
    </View>
  );
}

// What's shown in place of the sidebar when it's hidden
export function SidebarShowButton() {
  const theme = useTheme();
  const dispatch = useDispatch();
  return (
    <View style={[styles.hidden, { backgroundColor: theme.colors.sidebar, borderRightColor: theme.colors.border }]}>
      <IconButton
        containerColor="transparent"
        iconColor={theme.colors.textMuted}
        icon="chevron-double-right"
        size={20}
        accessibilityLabel="Show the sidebar"
        onPress={() => dispatch(setSettings({ sidebarVisible: true }) as any)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    borderRightWidth: StyleSheet.hairlineWidth,
    // Over the screen next to it, which the handle of the edge reaches into
    zIndex: 1,
  },
  // The handle to drag the edge with, over the edge
  resize: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: -3,
    width: 6,
    zIndex: 1,
  },
  hidden: {
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingTop: 8,
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginBottom: 8,
    paddingLeft: 10,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 38,
  },
  newNote: {
    marginHorizontal: 12,
    marginBottom: 14,
    borderRadius: 10,
  },
  newNoteInner: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  newNoteText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  tree: {
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: {
    flex: 1,
    minHeight: 36,
    justifyContent: "center",
    borderRadius: 8,
    paddingLeft: 4,
  },
  syncState: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 14,
    fontFamily: fonts.regular,
    // The box around it shows where the text goes already
    outlineStyle: "none",
  } as any,
  row: {
    paddingRight: 4,
    minHeight: 34,
    justifyContent: "center",
    borderRadius: 8,
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
  },
  icon: {
    marginLeft: 6,
    marginRight: 8,
  },
  smallButton: {
    margin: 0,
  },
  color: {
    width: 10,
    height: 10,
    borderRadius: 3,
    marginRight: 8,
  },
  count: {
    fontSize: 12,
    marginLeft: 4,
  },
  dim: {
    opacity: 0.6,
  },
  empty: {
    padding: 16,
  },
});
