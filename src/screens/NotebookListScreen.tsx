import * as React from "react";
import { StyleSheet, FlatList, Platform, View, BackHandler } from "react-native";
import { Appbar as PaperAppbar, List, FAB } from "react-native-paper";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";

import { useSyncGate, usePendingCount } from "../SyncGate";
import { StoreState } from "../store";
import { notesSelector, sortedNotebooksSelector } from "../store/selectors";
import { SyncManager } from "../sync/SyncManager";
import { performSync } from "../store/actions";
import { useCredentials } from "../credentials";

import NoteList from "../components/NoteList";
import Appbar from "../widgets/Appbar";
import AppbarAction from "../widgets/AppbarAction";
import AppbarButton from "../widgets/AppbarButton";
import NotFound from "../widgets/NotFound";
import CollectionRow from "../widgets/CollectionRow";
import { DefaultNavigationProp } from "../RootStackParamList";
import { useTheme } from "../theme";

interface PropsType {
  colUid?: string;
  active: boolean;
}

type Notebook = ReturnType<typeof sortedNotebooksSelector>[number];

export default function NotebookListScreen(props: PropsType) {
  const notebooks = useSelector(sortedNotebooksSelector);
  const cacheItems = useSelector(notesSelector);
  const navigation = useNavigation<DefaultNavigationProp>();
  const syncGate = useSyncGate();
  const theme = useTheme();

  const { colUid, active } = props;
  const cacheCollection = (colUid) ? notebooks.find((col) => col.uid === colUid) : undefined;
  const [notebook, setNotebook] = React.useState(cacheCollection);

  // Follow changes to the open notebook, and leave it when it's deleted
  React.useEffect(() => {
    if (notebook) {
      setNotebook(notebooks.find((col) => col.uid === notebook.uid));
    }
  }, [notebooks]);

  React.useEffect(() => {
    if (!active) {
      return;
    }

    navigation.setOptions({
      header: (props) => <Appbar {...props} menuFallback />,
      title: notebook?.name || "Notebooks",
      // (set by the list of notes)
      headerTitle: undefined,
      headerShadowVisible: undefined,
      headerLeft: (notebook) ? () => <PaperAppbar.BackAction containerColor="transparent" color={theme.colors.text} onPress={() => setNotebook(undefined)} /> : undefined,
      headerRight: () => (
        <RightAction colUid={notebook?.uid} />
      ),
    });
  }, [active, navigation, notebook]);

  const onBackPress = React.useCallback(() => {
    if (active && notebook) {
      setNotebook(undefined);
      return true;
    } else {
      return false;
    }
  }, [active, notebook]);

  React.useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", onBackPress);

    return () => backHandler.remove();
  }, [onBackPress]);

  if (syncGate) {
    return syncGate;
  }

  if (colUid && !cacheCollection) {
    return <NotFound />;
  }

  function renderItem({ item, index }: { item: Notebook, index: number }) {
    return (
      <CollectionRow
        name={item.name}
        description={item.description}
        color={item.color}
        count={cacheItems.get(item.uid)?.count((x) => !x.isDeleted) ?? 0}
        first={index === 0}
        last={index === notebooks.length - 1}
        onPress={() => setNotebook(item)}
      />
    );
  }

  return (
    <>
      {notebook ? (
        <NoteList
          colUid={notebook.uid}
          sortBy="name"
        />
      ) : (
        <FlatList
          style={[{ backgroundColor: theme.colors.background }, { flex: 1 }]}
          contentContainerStyle={styles.list}
          data={notebooks}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          maxToRenderPerBatch={10}
          ListEmptyComponent={() => (
            <List.Item
              title="No Notebooks"
            />
          )}
        />
      )}

      <FAB
        icon="plus"
        accessibilityLabel="New"
        color={theme.colors.onAccent}
        style={[styles.fab, { backgroundColor: theme.colors.accent }]}
        onPress={() => navigation.navigate("CollectionCreate")}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    margin: 20,
    right: 0,
    bottom: 0,
    borderRadius: 18,
  },
  list: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 112,
  },
});

interface RightActionPropsType {
  colUid?: string;
}

function RightAction(props: RightActionPropsType) {
  const etebase = useCredentials()!;
  const syncDispatch = useDispatch();
  const isSyncing = useSelector((state: StoreState) => state.syncCount) > 0;
  const pendingCount = usePendingCount();
  const navigation = useNavigation<DefaultNavigationProp>();
  const { colUid } = props;

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

  return (
    <View style={{ flexDirection: "row" }}>
      <AppbarAction
        icon={(pendingCount > 0) ? "cloud-upload-outline" : "sync"}
        accessibilityLabel={(pendingCount > 0) ? `Sync (${pendingCount} not uploaded yet)` : "Sync"}
        disabled={isSyncing}
        onPress={refresh}
      />
      {colUid && (
        <AppbarButton
          icon="pencil-outline"
          title="Edit notebook"
          disabled={isSyncing}
          onPress={() => navigation.navigate("CollectionEdit", { colUid })}
        />
      )}
      {colUid && (
        <AppbarButton
          icon="notebook"
          title="Manage Notebook"
          disabled={isSyncing}
          onPress={() => navigation.navigate("CollectionChangelog", { colUid })}
        />
      )}
    </View>
  );
}