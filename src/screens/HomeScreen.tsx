// SPDX-FileCopyrightText: Â© 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { StyleSheet, View } from "react-native";
import { BottomNavigation, Text, TouchableRipple } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { RootStackParamList } from "../RootStackParamList";

import NoteListScreen, { EmptyNotes } from "./NoteListScreen";
import { useWideLayout, useWideNavigation } from "../components/WideLayout";
import { StoreState } from "../store";
import { fonts } from "../theme";
import SearchScreen from "./SearchScreen";
import NotebookListScreen from "./NotebookListScreen";
import { useTheme } from "../theme";

interface PropsType {
  route: RouteProp<RootStackParamList, "Home"> | RouteProp<RootStackParamList, "Collection">;
}

const routes = [
  { key: "notes", title: "Notes", focusedIcon: "note-multiple" },
  { key: "search", title: "Search", focusedIcon: "magnify" },
  { key: "notebooks", title: "Notebooks", focusedIcon: "notebook-multiple" },
];

// Wide screens list the notes in a column of their own, next to the screen, which shows the open note.
// Without one it says where they are.
function NoNoteOpen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { filterBy, navigate } = useWideNavigation();
  const hasNotes = useSelector((state: StoreState) => state.cache.items.some((items) => items.some((x) => !x.isDeleted)));

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
    return () => navigation.setOptions({ headerShown: true });
  }, [navigation]);

  const create = () => navigate("NoteCreate", (filterBy) ? { colUid: filterBy } : undefined);
  if (!hasNotes) {
    return (
      <View style={[styles.placeholder, { backgroundColor: theme.colors.background }]}>
        <EmptyNotes onCreate={create} />
      </View>
    );
  }

  return (
    <View style={[styles.placeholder, { backgroundColor: theme.colors.background }]}>
      <MaterialCommunityIcons name="note-text-outline" size={44} color={theme.colors.disabled} />
      <Text style={[styles.placeholderTitle, { color: theme.colors.text }]}>No note open</Text>
      <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>Choose a note from the list, or write a new one.</Text>
      <TouchableRipple
        borderless
        accessibilityRole="button"
        onPress={create}
        style={[styles.placeholderButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
      >
        <View style={styles.placeholderButtonInner}>
          <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.colors.text} />
          <Text style={[styles.placeholderButtonText, { color: theme.colors.text }]}>Write a new note</Text>
        </View>
      </TouchableRipple>
    </View>
  );
}

export default function HomeScreen(props: PropsType) {
  if (useWideLayout()) {
    return <NoNoteOpen />;
  }
  return <TabsScreen {...props} />;
}

function TabsScreen(props: PropsType) {
  const [index, setIndex] = React.useState(0);
  const theme = useTheme();
  const activeRoute = routes[index];
  const renderScene = ({ route }: { route: { key: string } }) => {
    switch (route.key) {
      case "notes":
        return <NoteListScreen active={activeRoute?.key === "notes"} onSearch={() => setIndex(1)} />;
      case "search":
        return <SearchScreen active={activeRoute?.key === "search"} />;
      case "notebooks":
        return <NotebookListScreen colUid={colUid} active={activeRoute?.key === "notebooks"} />;
      default:
        return null;
    }
  };

  const colUid = props.route.params?.colUid || undefined;

  React.useEffect(() => {
    if (colUid) {
      setIndex(2);
    }
  }, []);

  return (
    <BottomNavigation
      navigationState={{ index, routes }}
      onIndexChange={setIndex}
      renderScene={renderScene}
      shifting={false}
      activeColor={theme.colors.accent}
      inactiveColor={theme.colors.textMuted}
      barStyle={{
        backgroundColor: theme.colors.surface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border,
        elevation: 0,
      }}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  placeholderTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    marginTop: 14,
  },
  placeholderText: {
    fontSize: 14,
    marginTop: 4,
    textAlign: "center",
  },
  placeholderButton: {
    marginTop: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  placeholderButtonInner: {
    height: 40,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  placeholderButtonText: {
    fontFamily: fonts.medium,
    fontSize: 14,
  },
});
