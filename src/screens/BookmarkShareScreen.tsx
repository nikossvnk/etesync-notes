// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Text, TouchableRipple } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { RouteProp, StackActions, useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCredentials } from "../credentials";
import { bookmarkCollectionsSelector, bookmarksSelector } from "../store/selectors";
import { RootStackParamList } from "../RootStackParamList";
import {
  Bookmark, allTags, bookmarkCollections, bookmarkTitle, bookmarksFrom, comparableUrl, createBookmark, deleteBookmark,
  domainOf, fromShared, isValidUrl, normalizeUrl, revertBookmark, updateBookmark,
} from "../bookmarks";
import { CollectionPicker, DuplicateNotice, Field, TagPicker } from "../components/BookmarkForm";
import { SiteTile } from "./BookmarkListScreen";
import useKeyboardHeight from "../widgets/useKeyboardHeight";
import { fonts, useTheme } from "../theme";

export interface Shared {
  // What was shared: a text (which has the link in it), and its subject (often the page's title)
  text?: string;
  subject?: string;
  // Or the link and the title themselves
  url?: string;
  title?: string;
}

interface PropsType {
  shared: Shared;
  // Closing it (cancel, or done after saving)
  onClose: () => void;
  onOpenBookmarks: () => void;
  // Opening the full form, with what's in the sheet
  onMoreOptions: (data: { url: string, title: string }) => void;
  onLogin: () => void;
}

// Where it was saved: the bookmark, and what it was before if it was there already (to undo it)
type Saved = { colUid: string, uid: string, before?: Bookmark };

// Saving a link that was shared with the app: a sheet at the bottom with the title (filled in, and
// ready to be changed), a note and tags. After saving it says so, with an undo.
export function ShareSheet(props: PropsType) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const etebase = useCredentials();
  const bookmarkItems = useSelector(bookmarksSelector);
  const bookmarks = React.useMemo(() => bookmarksFrom(bookmarkItems), [bookmarkItems]);
  const knownTags = React.useMemo(() => allTags(bookmarks), [bookmarks]);
  const cols = useSelector(bookmarkCollectionsSelector);
  const collections = React.useMemo(() => bookmarkCollections({ cache: { collections: cols } }), [cols]);
  const { shared, onClose, onOpenBookmarks, onMoreOptions, onLogin } = props;

  const initial = React.useMemo(() => {
    const found = fromShared(shared.text ?? shared.url ?? "", shared.subject);
    return { url: normalizeUrl(shared.url || found.url), title: shared.title ?? found.title };
  }, [shared]);
  // A link that was saved already is changed rather than saved a second time
  const [existing] = React.useState(() => bookmarks.find((x) => comparableUrl(x.url) === comparableUrl(initial.url)));
  const [title, setTitle] = React.useState(existing?.title || initial.title);
  const [note, setNote] = React.useState(existing?.note ?? "");
  const [tags, setTags] = React.useState<string[]>(existing?.tags ?? []);
  const [colUid, setColUid] = React.useState<string | undefined>(existing?.colUid);
  const [saved, setSaved] = React.useState<Saved>();
  const [busy, setBusy] = React.useState(false);
  const url = initial.url;
  const valid = isValidUrl(url);
  const keyboard = useKeyboardHeight();

  async function save() {
    if (busy || !valid) {
      return;
    }
    setBusy(true);
    const data = { url, title, note, tags };
    const where = (existing) ? await updateBookmark(etebase!, existing, data, colUid) : await createBookmark(etebase!, data, colUid);
    setSaved({ ...where, before: existing });
    setBusy(false);
  }

  async function undo() {
    if (!saved || busy) {
      return;
    }
    setBusy(true);
    if (saved.before && (saved.before.colUid === saved.colUid)) {
      await revertBookmark(etebase!, saved.before);
    } else {
      const now = bookmarks.find((x) => (x.colUid === saved.colUid) && (x.uid === saved.uid));
      if (now) {
        await deleteBookmark(etebase!, now);
      }
    }
    setSaved(undefined);
    setBusy(false);
  }

  const sheetStyle = [styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, paddingBottom: 18 + insets.bottom }];

  let content: React.ReactNode;
  if (etebase === undefined) {
    // (still loading the account)
    content = null;
  } else if (!etebase) {
    content = (
      <View style={sheetStyle} role="dialog" aria-label="Save bookmark">
        <Heading title="Save bookmark" onClose={onClose} />
        <Text style={[styles.text, { color: theme.colors.textSecondary }]}>Log in to EteSync Notes first, then share the link again to save it.</Text>
        <MainButton label="Open EteSync Notes" onPress={onLogin} />
      </View>
    );
  } else if (!valid) {
    content = (
      <View style={sheetStyle} role="dialog" aria-label="Save bookmark">
        <Heading title="Save bookmark" onClose={onClose} />
        <Text style={[styles.text, { color: theme.colors.textSecondary }]}>There's no link in what was shared, so there's nothing to save.</Text>
        <MainButton label="Close" onPress={onClose} />
      </View>
    );
  } else if (saved) {
    content = (
      <View style={[styles.confirmation, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, marginBottom: 16 + insets.bottom }]} role="status">
        <View style={styles.confirmationTop}>
          <View style={[styles.check, { backgroundColor: theme.colors.success + "2E" }]}>
            <MaterialCommunityIcons name="check" size={20} color={theme.colors.success} />
          </View>
          <View style={styles.grow}>
            <Text style={[styles.confirmationTitle, { color: theme.colors.text }]}>{(saved.before) ? "Bookmark updated" : "Bookmark saved"}</Text>
            <Text style={[styles.small, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {bookmarkTitle({ title, url })}
            </Text>
          </View>
          <TouchableRipple borderless onPress={undo} disabled={busy} accessibilityRole="button" style={styles.undo}>
            <Text style={[styles.undoText, { color: theme.colors.accentText }]}>Undo</Text>
          </TouchableRipple>
        </View>
        <View style={styles.confirmationButtons}>
          <TouchableRipple
            borderless
            onPress={onOpenBookmarks}
            accessibilityRole="button"
            style={[styles.secondary, styles.grow, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.secondaryText, { color: theme.colors.text }]}>Open Bookmarks</Text>
          </TouchableRipple>
          <View style={styles.grow}>
            <MainButton label="Done" onPress={onClose} />
          </View>
        </View>
      </View>
    );
  } else {
    content = (
      <View style={sheetStyle} role="dialog" aria-label={(existing) ? "Already in Bookmarks" : "Save bookmark"} aria-modal>
        <Heading title={(existing) ? "Already in Bookmarks" : "Save bookmark"} onClose={onClose} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.fields} style={styles.scroll}>
          {existing && <DuplicateNotice existing={existing} />}
          <View style={[styles.site, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
            <SiteTile url={url} />
            <View style={styles.grow}>
              <Text style={[styles.siteName, { color: theme.colors.text }]} numberOfLines={1}>{domainOf(url)}</Text>
              <Text style={[styles.small, { color: theme.colors.textMuted }]} numberOfLines={1}>{url.replace(/^https?:\/\//, "")}</Text>
            </View>
          </View>
          <Field label="Title" value={title} onChangeText={setTitle} placeholder={domainOf(url)} autoFocus selectTextOnFocus={false} />
          <Field label="Note" optional value={note} onChangeText={setNote} placeholder="Why you saved it" />
          <TagPicker value={tags} onChange={setTags} known={knownTags} max={4} />
          <CollectionPicker collections={collections} value={colUid} onChange={setColUid} />
        </ScrollView>
        <View style={styles.buttons}>
          <TouchableRipple
            borderless
            onPress={() => onMoreOptions({ url, title })}
            accessibilityRole="button"
            style={[styles.secondary, { borderColor: theme.colors.border, paddingHorizontal: 16 }]}
          >
            <Text style={[styles.secondaryText, { color: theme.colors.text }]}>More options</Text>
          </TouchableRipple>
          <View style={styles.grow}>
            <MainButton label={(existing) ? "Update bookmark" : "Save"} onPress={save} disabled={busy} />
          </View>
        </View>
      </View>
    );
  }

  return (
    // (on Android the window isn't made smaller for the keyboard, as it's drawn behind the system's bars)
    <KeyboardAvoidingView behavior={(Platform.OS === "ios") ? "padding" : undefined} style={[styles.container, (Platform.OS === "android") && { paddingBottom: keyboard }]}>
      <TouchableRipple
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={(saved) ? onClose : undefined}
        accessible={false}
        rippleColor="transparent"
      >
        <View />
      </TouchableRipple>
      {content}
    </KeyboardAvoidingView>
  );
}

function Heading(props: { title: string, onClose: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.heading}>
      <View style={[styles.headingIcon, { backgroundColor: theme.colors.accentTint }]}>
        <MaterialCommunityIcons name="bookmark-outline" size={17} color={theme.colors.accent} />
      </View>
      <Text style={[styles.headingText, { color: theme.colors.text }]} accessibilityRole="header">{props.title}</Text>
      <TouchableRipple borderless onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Cancel" style={styles.close}>
        <MaterialCommunityIcons name="close" size={20} color={theme.colors.textMuted} />
      </TouchableRipple>
    </View>
  );
}

function MainButton(props: { label: string, onPress: () => void, disabled?: boolean }) {
  const theme = useTheme();
  return (
    <TouchableRipple
      borderless
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      style={[styles.main, { backgroundColor: theme.colors.accent }]}
    >
      <Text style={[styles.mainText, { color: theme.colors.onAccent }]}>{props.label}</Text>
    </TouchableRipple>
  );
}

// The sheet as a screen of the app, for a link that was shared with it while it's open (and on the
// web, where it's opened with /share?url=…&title=…). Done goes to the bookmarks.
export function BookmarkShareRoute(props: { route: RouteProp<RootStackParamList, "BookmarkShare"> }) {
  const navigation = useNavigation<any>();
  const params = props.route.params ?? {};
  const shared = React.useMemo(() => ({ url: params.url, title: params.title, text: params.text }), [params.url, params.title, params.text]);

  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const toBookmarks = () => navigation.dispatch(StackActions.replace("Bookmarks"));
  return (
    <ShareSheet
      shared={shared}
      onClose={toBookmarks}
      onOpenBookmarks={toBookmarks}
      onMoreOptions={(data) => navigation.dispatch(StackActions.replace("BookmarkCreate", data))}
      onLogin={() => navigation.navigate("Login")}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    backgroundColor: "rgba(5,6,8,0.55)",
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "92%",
    alignSelf: "center",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingTop: 12,
    paddingHorizontal: 18,
    gap: 14,
  },
  scroll: {
    flexGrow: 0,
  },
  fields: {
    gap: 14,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headingIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  headingText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 18,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: -10,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  small: {
    fontSize: 12,
  },
  site: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  siteName: {
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  buttons: {
    flexDirection: "row",
    gap: 8,
  },
  secondary: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  main: {
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  mainText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  confirmation: {
    width: "auto",
    maxWidth: 616,
    alignSelf: "stretch",
    marginHorizontal: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 14,
  },
  confirmationTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  check: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmationTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  undo: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 9,
    justifyContent: "center",
  },
  undoText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  confirmationButtons: {
    flexDirection: "row",
    gap: 8,
  },
});
