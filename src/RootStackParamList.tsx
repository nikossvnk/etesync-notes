
import { StackNavigationProp } from "@react-navigation/stack";

export type RootStackParamList = {
  Home: undefined;
  Search: undefined;
  Notebooks: undefined;
  Login: undefined;
  Signup: undefined;
  CollectionCreate: undefined;
  Collection: { colUid: string };
  CollectionEdit: { colUid: string };
  CollectionChangelog: { colUid: string };
  CollectionMembers: { colUid: string };
  NoteCreate: {
    colUid: string;
    itemUid?: undefined;
  } | undefined;
  NoteEdit: {
    colUid: string;
    itemUid: string;
  };
  NoteProps: {
    colUid: string;
    itemUid: string;
  };
  NoteMove: {
    colUid: string;
    itemUid: string;
  };
  Bookmarks: undefined;
  // The bookmark lists, one list's bookmarks, and making or changing a list
  BookmarkLists: undefined;
  BookmarkList: { colUid: string };
  BookmarkListCreate: undefined;
  BookmarkListEdit: { colUid: string };
  // (colUid: the list it's saved to at first)
  BookmarkCreate: { url?: string, title?: string, colUid?: string } | undefined;
  BookmarkEdit: { colUid: string, itemUid: string };
  // Saving a link that was shared with the app
  BookmarkShare: { url?: string, title?: string, text?: string } | undefined;
  Invitations: undefined;
  Settings: undefined;
  Password: undefined;
  About: undefined;
  DebugLogs: undefined;
  AccountWizard: undefined;
  "404": undefined;
};

export type DefaultNavigationProp = StackNavigationProp<RootStackParamList, keyof RootStackParamList>;
