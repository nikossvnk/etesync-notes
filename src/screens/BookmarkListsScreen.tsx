import * as React from "react";
import { FlatList, StyleSheet } from "react-native";
import { FAB, List } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";

import { useSyncGate } from "../SyncGate";
import { bookmarksSelector } from "../store/selectors";
import { bookmarkListsSelector } from "../bookmarks";
import { SyncButton } from "./BookmarkListScreen";

import Appbar from "../widgets/Appbar";
import CollectionRow from "../widgets/CollectionRow";
import { DefaultNavigationProp } from "../RootStackParamList";
import { useTheme } from "../theme";

// The bookmark lists, like the notebooks: a list opens its bookmarks, and lists are made here
export default function BookmarkListsScreen() {
  const lists = useSelector(bookmarkListsSelector);
  const cacheItems = useSelector(bookmarksSelector);
  const navigation = useNavigation<DefaultNavigationProp>();
  const syncGate = useSyncGate();
  const theme = useTheme();

  React.useEffect(() => {
    navigation.setOptions({
      header: (props) => <Appbar {...props} menuFallback />,
      headerRight: () => <SyncButton />,
    });
  }, [navigation]);

  if (syncGate) {
    return syncGate;
  }

  return (
    <>
      <FlatList
        style={[{ backgroundColor: theme.colors.background }, { flex: 1 }]}
        contentContainerStyle={styles.list}
        data={lists}
        keyExtractor={(item) => item.uid}
        renderItem={({ item, index }) => (
          <CollectionRow
            name={item.name}
            description={item.description}
            color={item.color}
            count={cacheItems.get(item.uid)?.count((x) => !x.isDeleted) ?? 0}
            first={index === 0}
            last={index === lists.length - 1}
            onPress={() => navigation.navigate("BookmarkList", { colUid: item.uid })}
          />
        )}
        ListEmptyComponent={() => (
          <List.Item
            title="No Bookmark Lists"
          />
        )}
      />

      <FAB
        icon="plus"
        accessibilityLabel="New"
        color={theme.colors.onAccent}
        style={[styles.fab, { backgroundColor: theme.colors.accent }]}
        onPress={() => navigation.navigate("BookmarkListCreate")}
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
