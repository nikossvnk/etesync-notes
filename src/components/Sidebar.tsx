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
import { useTheme } from "../theme";
import { getSortFunction } from "./NoteList";

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
const noteScreens = ["NoteEdit", "NoteProps", "NoteMove"];

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
      style={[styles.row, { paddingLeft: 8 + indent * 20 }, (selected) ? { backgroundColor: theme.colors.activeBackground } : undefined]}
    >
      <View style={styles.rowContent}>
        {left}
        <Text
          numberOfLines={1}
          style={[styles.rowLabel, (selected) ? { color: theme.colors.active, fontWeight: "bold" } : undefined, (dim) ? styles.dim : undefined]}
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

  const borderColor = theme.colors.disabled;

  return (
    <View
      testID="sidebar"
      style={[styles.sidebar, { width: resize.width, backgroundColor: theme.colors.surface, borderRightColor: borderColor },
        // No text gets selected while dragging the edge
        (resize.dragging && (Platform.OS === "web")) ? ({ userSelect: "none" } as any) : undefined]}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notebooks</Text>
        <IconButton
          icon="note-plus-outline"
          size={20}
          accessibilityLabel="New note"
          onPress={() => navigation.navigate("Root", { screen: "NoteCreate", params: (filterBy) ? { colUid: filterBy } : undefined })}
        />
        <IconButton
          icon="notebook-plus-outline"
          size={20}
          accessibilityLabel="New notebook"
          onPress={() => navigation.navigate("Root", { screen: "CollectionCreate" })}
        />
        <IconButton
          icon="chevron-double-left"
          size={20}
          accessibilityLabel="Hide the sidebar"
          onPress={() => setVisible(false)}
        />
      </View>
      <View style={[styles.search, { borderColor }]}>
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
          <IconButton icon="close" size={16} style={styles.smallButton} accessibilityLabel="Clear" onPress={() => setFilter("")} />
        )}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
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
                    <Text style={[styles.count, styles.dim]}>{notebook.count}</Text>
                    <IconButton
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
                  label={item.meta.name ?? ""}
                  accessibilityLabel={`Note ${item.meta.name}`}
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
    <View style={[styles.hidden, { backgroundColor: theme.colors.surface, borderRightColor: theme.colors.disabled }]}>
      <IconButton
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
    fontSize: 16,
    fontWeight: "bold",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginBottom: 8,
    paddingLeft: 8,
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 36,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 14,
  },
  row: {
    paddingRight: 4,
    minHeight: 34,
    justifyContent: "center",
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
    borderRadius: 5,
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
