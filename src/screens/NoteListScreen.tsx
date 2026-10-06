// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { StyleSheet, View, Platform } from "react-native";
import { FAB } from "react-native-paper";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSelector, useDispatch } from "react-redux";

import { useSyncGate, usePendingCount } from "../SyncGate";
import { StoreState } from "../store";
import { SyncManager } from "../sync/SyncManager";
import { performSync, setSettings } from "../store/actions";
import { useCredentials } from "../credentials";

import NoteList from "../components/NoteList";
import NotebookFilter from "../components/NotebookFilter";
import { useSidebarShown } from "../components/Sidebar";
import Appbar from "../widgets/Appbar";
import Menu from "../widgets/Menu";
import MenuItem from "../widgets/MenuItem";
import AppbarAction from "../widgets/AppbarAction";
import AppbarButton, { useWideAppbar } from "../widgets/AppbarButton";
import { DefaultNavigationProp } from "../RootStackParamList";
import { useTheme } from "../theme";

interface PropsType {
  active: boolean;
}

export default function NoteListScreen(props: PropsType) {
  const viewSettings = useSelector((state: StoreState) => state.settings.viewSettings);
  const { sortBy } = viewSettings;
  // Show all of the notes if the notebook that was filtered by is gone
  const filterBy = useSelector((state: StoreState) => (
    (viewSettings.filterBy && state.cache.collections.has(viewSettings.filterBy)) ? viewSettings.filterBy : undefined
  ));
  const dispatch = useDispatch();
  const navigation = useNavigation<DefaultNavigationProp>();
  const syncGate = useSyncGate();
  const theme = useTheme();
  // The sidebar has the notebooks to choose from already
  const sidebarShown = useSidebarShown();

  const { active } = props;

  React.useEffect(() => {
    if (!active) {
      return;
    }

    navigation.setOptions({
      header: (props) => <Appbar {...props} menuFallback />,
      title: "Notes",
      headerRight: () => (
        <RightAction />
      ),
    });
  }, [active, navigation]);

  if (syncGate) {
    return syncGate;
  }

  return (
    <>
      {!sidebarShown && <NotebookFilter
        value={filterBy}
        onChange={(colUid) => {
          dispatch(setSettings({
            viewSettings: {
              ...viewSettings,
              filterBy: colUid ?? null,
            },
          }) as any);
        }}
      />}
      <NoteList
        colUid={filterBy}
        sortBy={sortBy}
      />

      <FAB
        icon="plus"
        accessibilityLabel="New"
        color={theme.colors.onAccent}
        style={styles.fab}
        onPress={() => navigation.navigate("NoteCreate", (filterBy) ? { colUid: filterBy } : undefined)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

interface RightActionPropsType {
  colUid?: string;
}

function RightAction(props: RightActionPropsType) {
  const etebase = useCredentials()!;
  const [showMenu, setShowMenu] = React.useState(false);
  const [showSortMenu, setShowSortMenu_] = React.useState(false);
  const syncDispatch = useDispatch();
  const isSyncing = useSelector((state: StoreState) => state.syncCount) > 0;
  const pendingCount = usePendingCount();
  const viewSettings = useSelector((state: StoreState) => state.settings.viewSettings);
  const navigation = useNavigation<DefaultNavigationProp>();
  const wide = useWideAppbar();
  // The notebook whose notes are listed
  const filterBy = useSelector((state: StoreState) => (
    (viewSettings.filterBy && state.cache.collections.has(viewSettings.filterBy)) ? viewSettings.filterBy : undefined
  ));
  const { colUid } = props;

  function setSortBy(sortBy: "name" | "mtime") {
    syncDispatch(setSettings({
      viewSettings: {
        ...viewSettings,
        sortBy,
      },
    }) as any);
  }

  function setShowSortMenu(value: boolean) {
    setShowSortMenu_(value);
    setShowMenu(value);
  }

  async function refresh() {
    const syncManager = SyncManager.getManager(etebase!);
    syncDispatch(performSync(syncManager.sync()) as any); // not awaiting on puprose
  }

  useFocusEffect(React.useCallback(() => {
    if (!etebase) {
      return () => true;
    }

    refresh();

    if (Platform.OS !== "web") {
      return () => true;
    }

    function autoRefresh() {
      if (navigator.onLine && etebase) {
        refresh();
      }
    }

    const interval = 5 * 60 * 1000;
    const id = setInterval(autoRefresh, interval);
    return () => clearInterval(id);
  }, [etebase]));

  if (wide) {
    // The sort order is a button that switches between the two
    const byName = (viewSettings.sortBy === "name");
    return (
      <View style={{ flexDirection: "row" }}>
        <AppbarButton
          icon={(pendingCount > 0) ? "cloud-upload-outline" : "sync"}
          title={(pendingCount > 0) ? `Sync (${pendingCount} not uploaded yet)` : "Sync"}
          disabled={isSyncing}
          onPress={refresh}
        />
        <AppbarButton
          icon={(byName) ? "sort-alphabetical-ascending" : "sort-clock-descending-outline"}
          title={(byName) ? "Sorted by name, sort by modification time" : "Sorted by modification time, sort by name"}
          disabled={isSyncing}
          onPress={() => setSortBy((byName) ? "mtime" : "name")}
        />
        {(colUid ?? filterBy) && (
          <AppbarButton
            icon="notebook"
            title="Manage Notebook"
            disabled={isSyncing}
            onPress={() => navigation.navigate("CollectionChangelog", { colUid: (colUid ?? filterBy)! })}
          />
        )}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row" }}>
      <AppbarAction
        icon={(pendingCount > 0) ? "cloud-upload-outline" : "sync"}
        accessibilityLabel={(pendingCount > 0) ? `Sync (${pendingCount} not uploaded yet)` : "Sync"}
        disabled={isSyncing}
        onPress={() => {
          setShowMenu(false);
          refresh();
        }}
      />
      <Menu
        visible={showMenu}
        onDismiss={() => setShowMenu(false)}
        anchor={(
          <AppbarAction icon="dots-vertical" accessibilityLabel="Menu" onPress={() => setShowMenu(true)} />
        )}
      >
        <Menu
          visible={showSortMenu}
          onDismiss={() => setShowSortMenu(false)}
          anchor={(
            <Menu.Item leadingIcon="sort" title="Sort by"
              disabled={isSyncing}
              onPress={() => {
                setShowSortMenu(true);
              }}
            />
          )}
        >
          <MenuItem icon="sort-alphabetical" title="Name"
            disabled={isSyncing}
            active={viewSettings.sortBy === "name"}
            onPress={() => {
              setShowSortMenu(false);
              syncDispatch(setSettings({
                viewSettings: {
                  ...viewSettings,
                  sortBy: "name",
                },
              }) as any);
            }}
          />
          <MenuItem icon="sort-numeric" title="Modification time"
            disabled={isSyncing}
            active={viewSettings.sortBy === "mtime"}
            onPress={() => {
              setShowSortMenu(false);
              syncDispatch(setSettings({
                viewSettings: {
                  ...viewSettings,
                  sortBy: "mtime",
                },
              }) as any);
            }}
          />
        </Menu>
        {colUid && (
          <MenuItem icon="notebook" title="Manage Notebook"
            disabled={isSyncing}
            onPress={() => {
              setShowMenu(false);
              navigation.navigate("CollectionChangelog", { colUid });
            }}
          />
        )}
      </Menu>
    </View>
  );
}
