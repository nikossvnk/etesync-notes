// SPDX-FileCopyrightText: Â© 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { StyleSheet } from "react-native";
import { BottomNavigation } from "react-native-paper";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../RootStackParamList";

import NoteListScreen from "./NoteListScreen";
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

export default function HomeScreen(props: PropsType) {
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
