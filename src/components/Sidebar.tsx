// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Linking, PanResponder, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { Divider, IconButton, Text, TouchableRipple } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";

import { StoreState } from "../store";
import { setSettings } from "../store/actions";
import { defaultColor, serverName } from "../helpers";
import { cardShadow, fonts, useTheme } from "../theme";
import { usePendingCount } from "../SyncGate";
import { useCredentials } from "../credentials";
import { externalMenuItems, FingerprintDialog } from "../Drawer";
import LogoutDialog from "./LogoutDialog";
import Menu from "../widgets/Menu";
import MenuItem from "../widgets/MenuItem";
import { useSearchQuery, useWideNavigation } from "./WideLayout";

export { useSidebarShown } from "./WideLayout";

// The sidebar's width can be changed between these, and always leaves room for the columns next to it
const minWidth = 200;
const maxWidth = 400;
const minScreenWidth = 720;

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

interface RowPropsType {
  label: string;
  accessibilityLabel: string;
  selected?: boolean;
  onPress: () => void;
  left?: React.ReactNode;
  count?: number;
}

function Row(props: RowPropsType) {
  const theme = useTheme();
  const { label, accessibilityLabel, selected, onPress, left, count } = props;

  return (
    <TouchableRipple
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!selected }}
      // The web doesn't get the state above for buttons
      aria-selected={!!selected}
      style={[styles.row, (selected) ? [{ backgroundColor: theme.colors.surface }, cardShadow] : undefined]}
    >
      <View style={styles.rowContent}>
        {left}
        <Text
          numberOfLines={1}
          style={[styles.rowLabel, { color: (selected) ? theme.colors.text : theme.colors.textBody },
            (selected) ? { fontFamily: fonts.medium } : undefined]}
        >
          {label}
        </Text>
        {(count !== undefined) && <Text style={[styles.count, { color: theme.colors.textMuted }]}>{count}</Text>}
      </View>
    </TouchableRipple>
  );
}

// The account the app is logged in to, with a menu of what the drawer has on phones
function Account() {
  const theme = useTheme();
  const etebase = useCredentials()!;
  const { navigate } = useWideNavigation();
  const syncCount = useSelector((state: StoreState) => state.syncCount);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showFingerprint, setShowFingerprint] = React.useState(false);
  const [showLogout, setShowLogout] = React.useState(false);
  const username = etebase.user.username;

  return (
    <View style={styles.account}>
      <View style={[styles.avatar, { backgroundColor: theme.colors.chipActive }]}>
        <Text style={[styles.avatarText, { color: theme.colors.onChipActive }]}>{username.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.accountText}>
        <Text style={[styles.username, { color: theme.colors.text }]} numberOfLines={1}>{username}</Text>
        <Text style={[styles.server, { color: theme.colors.textMuted }]} numberOfLines={1} accessibilityLabel={`Server: ${serverName(etebase.serverUrl)}`}>
          {serverName(etebase.serverUrl)}
        </Text>
      </View>
      <Menu
        visible={showMenu}
        onDismiss={() => setShowMenu(false)}
        anchor={(
          <IconButton
            containerColor="transparent"
            iconColor={theme.colors.textMuted}
            icon="chevron-down"
            size={20}
            style={styles.smallButton}
            accessibilityLabel="Account menu"
            onPress={() => setShowMenu(true)}
          />
        )}
      >
        <MenuItem icon="email-outline" title="Invitations" onPress={() => {
          setShowMenu(false);
          navigate("Invitations");
        }} />
        <MenuItem icon="fingerprint" title="Show Fingerprint" onPress={() => {
          setShowMenu(false);
          setShowFingerprint(true);
        }} />
        <MenuItem icon="exit-to-app" title="Logout" disabled={syncCount > 0} onPress={() => {
          setShowMenu(false);
          setShowLogout(true);
        }} />
        <Divider />
        {externalMenuItems.map((item) => (
          <MenuItem key={item.title} icon={item.icon} title={item.title} onPress={() => {
            setShowMenu(false);
            Linking.openURL(item.link);
          }} />
        ))}
      </Menu>
      <FingerprintDialog visible={showFingerprint} onDismiss={() => setShowFingerprint(false)} />
      <LogoutDialog visible={showLogout} onDismiss={() => setShowLogout(false)} />
    </View>
  );
}

// The first column on wide screens: the account, searching, the notebooks and the settings
export default function Sidebar() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentScreen, filterBy, navigate, showNotebook } = useWideNavigation();
  const { query, setQuery } = useSearchQuery();
  const cacheCollections = useSelector((state: StoreState) => state.cache.collections);
  const cacheItems = useSelector((state: StoreState) => state.cache.items);
  const savedWidth = useSelector((state: StoreState) => state.settings.sidebarWidth);
  const resize = useResize(savedWidth, (sidebarWidth) => dispatch(setSettings({ sidebarWidth }) as any));
  const pendingCount = usePendingCount();
  const isSyncing = useSelector((state: StoreState) => state.syncCount) > 0;

  const notebooks = React.useMemo(() => (
    Array.from(cacheCollections.entries())
      .map(([colUid, collection]) => ({
        colUid,
        name: collection.meta.name ?? "",
        color: collection.meta.color || defaultColor,
        count: cacheItems.get(colUid)?.count((x) => !x.isDeleted) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  ), [cacheCollections, cacheItems]);
  const total = notebooks.reduce((sum, x) => sum + x.count, 0);
  const searching = query.trim() !== "";

  function show(colUid: string | undefined) {
    setQuery("");
    showNotebook(colUid);
  }

  const borderColor = theme.colors.border;

  return (
    <View
      testID="sidebar"
      style={[styles.sidebar, { width: resize.width, backgroundColor: theme.colors.sidebar, borderRightColor: borderColor },
        // No text gets selected while dragging the edge
        (resize.dragging && (Platform.OS === "web")) ? ({ userSelect: "none" } as any) : undefined]}
    >
      <Account />
      <View style={[styles.search, { borderColor, backgroundColor: theme.colors.surface }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={theme.colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes"
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel="Search notes"
          style={[styles.searchInput, { color: theme.colors.text }]}
        />
        {searching && (
          <IconButton containerColor="transparent" iconColor={theme.colors.textMuted} icon="close" size={16} style={styles.smallButton} accessibilityLabel="Clear" onPress={() => setQuery("")} />
        )}
      </View>
      <TouchableRipple
        borderless
        accessibilityRole="button"
        accessibilityLabel="New note"
        style={[styles.newNote, { backgroundColor: theme.colors.accent }]}
        onPress={() => navigate("NoteCreate", (filterBy) ? { colUid: filterBy } : undefined)}
      >
        <View style={styles.newNoteInner}>
          <MaterialCommunityIcons name="plus" size={18} color={theme.colors.onAccent} />
          <Text style={[styles.newNoteText, { color: theme.colors.onAccent }]}>New note</Text>
        </View>
      </TouchableRipple>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.tree}>
        <Row
          label="All notes"
          accessibilityLabel="All notes"
          selected={!searching && !filterBy}
          onPress={() => show(undefined)}
          count={total}
          left={<MaterialCommunityIcons name="note-multiple-outline" size={18} color={theme.colors.textMuted} style={styles.icon} />}
        />
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>Notebooks</Text>
          <IconButton
            containerColor="transparent"
            iconColor={theme.colors.textMuted}
            icon="plus"
            size={18}
            style={styles.smallButton}
            accessibilityLabel="New notebook"
            onPress={() => navigate("CollectionCreate")}
          />
        </View>
        {notebooks.map((notebook) => (
          <Row
            key={notebook.colUid}
            label={notebook.name}
            accessibilityLabel={`Notebook ${notebook.name}`}
            selected={!searching && (filterBy === notebook.colUid)}
            onPress={() => show(notebook.colUid)}
            count={notebook.count}
            left={<View style={[styles.color, { backgroundColor: notebook.color }]} />}
          />
        ))}
        {(notebooks.length === 0) && (
          <Text style={[styles.empty, { color: theme.colors.textMuted }]}>No notebooks yet</Text>
        )}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: borderColor }]}>
        <Row
          label="Settings"
          accessibilityLabel="Settings"
          selected={currentScreen === "Settings"}
          onPress={() => navigate("Settings")}
          left={<MaterialCommunityIcons name="cog-outline" size={18} color={theme.colors.textMuted} style={styles.icon} />}
        />
        <View style={styles.syncState}>
          <View style={[styles.syncDot, { backgroundColor: (pendingCount > 0) ? theme.colors.disabled : theme.colors.success }]} />
          <Text style={[styles.count, styles.syncText, { color: theme.colors.textMuted }]}>
            {(isSyncing) ? "Syncing…" : (pendingCount > 0) ? `${pendingCount} to sync` : "Synced"}
          </Text>
          <IconButton
            containerColor="transparent"
            iconColor={theme.colors.textMuted}
            icon="chevron-double-left"
            size={20}
            style={styles.smallButton}
            accessibilityLabel="Hide the sidebar"
            onPress={() => dispatch(setSettings({ sidebarVisible: false }) as any)}
          />
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
    // Over the column next to it, which the handle of the edge reaches into
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
  // (its button is at the bottom, where the one that hides it is)
  hidden: {
    borderRightWidth: StyleSheet.hairlineWidth,
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  account: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 6,
    paddingTop: 14,
    paddingBottom: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  accountText: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  server: {
    fontSize: 12,
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
  searchInput: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 14,
    fontFamily: fonts.regular,
    // The box around it shows where the text goes already
    outlineStyle: "none",
  } as any,
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
    marginTop: 16,
    marginBottom: 2,
  },
  sectionTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  footer: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  syncState: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
  },
  syncText: {
    flex: 1,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  row: {
    paddingLeft: 10,
    paddingRight: 10,
    minHeight: 36,
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
    marginRight: 10,
  },
  smallButton: {
    margin: 0,
  },
  color: {
    width: 10,
    height: 10,
    borderRadius: 3,
    marginLeft: 4,
    marginRight: 12,
  },
  count: {
    fontSize: 12,
    marginLeft: 6,
  },
  empty: {
    padding: 12,
  },
});
