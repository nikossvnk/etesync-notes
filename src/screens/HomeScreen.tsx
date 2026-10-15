// SPDX-FileCopyrightText: Â© 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import { RouteProp, useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "../RootStackParamList";

import NoteListScreen from "./NoteListScreen";
import SearchScreen from "./SearchScreen";
import NotebookListScreen from "./NotebookListScreen";

interface PropsType {
  route: RouteProp<RootStackParamList, "Home"> | RouteProp<RootStackParamList, "Collection">;
}

// The notes, which have a search field that opens the search, and the notebooks in the menu
export default function HomeScreen(_props: PropsType) {
  const navigation = useNavigation<any>();
  return <NoteListScreen active onSearch={() => navigation.navigate("Search")} />;
}

// The search, as a screen of its own
export function SearchRoute() {
  return <SearchScreen active />;
}

// The notebooks (and the notes of one of them), as a screen of its own
export function NotebooksRoute(props: { route: RouteProp<RootStackParamList, "Notebooks"> | RouteProp<RootStackParamList, "Collection"> }) {
  const colUid = (props.route.params as any)?.colUid || undefined;
  return <NotebookListScreen colUid={colUid} active />;
}
