// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, TouchableRipple } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { RouteProp, useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import * as Clipboard from "expo-clipboard";
import { format } from "date-fns";

import { useSyncGate } from "../SyncGate";
import { useCredentials } from "../credentials";
import { bookmarkCollectionsSelector, bookmarksSelector } from "../store/selectors";
import { pushMessage } from "../store/actions";
import { RootStackParamList } from "../RootStackParamList";
import { goUp } from "../navigation";
import {
  Bookmark, BookmarkData, bookmarksFrom, allTags, bookmarkCollections, createBookmark, deleteBookmark, domainOf,
  fetchTitle, findUrl, isValidUrl, normalizeUrl, updateBookmark, comparableUrl, savedFromLabel,
} from "../bookmarks";
import { CollectionPicker, DuplicateNotice, Field, TagPicker } from "../components/BookmarkForm";
import { SiteTile } from "./BookmarkListScreen";
import ScrollView from "../widgets/ScrollView";
import useKeyboardHeight from "../widgets/useKeyboardHeight";
import NotFound from "../widgets/NotFound";
import { fonts, useTheme } from "../theme";

type PropsType = {
  route: RouteProp<RootStackParamList, "BookmarkCreate"> | RouteProp<RootStackParamList, "BookmarkEdit">;
};

// Adds a bookmark (with the link and title it's opened with, if any), or changes one
export default function BookmarkEditScreen(props: PropsType) {
  const { route } = props;
  const params: any = route.params ?? {};
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const theme = useTheme();
  const etebase = useCredentials();
  const syncGate = useSyncGate();
  const bookmarkItems = useSelector(bookmarksSelector);
  const bookmarks = React.useMemo(() => bookmarksFrom(bookmarkItems), [bookmarkItems]);
  const knownTags = React.useMemo(() => allTags(bookmarks), [bookmarks]);
  const cols = useSelector(bookmarkCollectionsSelector);
  const collections = React.useMemo(() => bookmarkCollections({ cache: { collections: cols } }), [cols]);

  const editing: Bookmark | undefined = (route.name === "BookmarkEdit") ?
    bookmarks.find((x) => (x.colUid === params.colUid) && (x.uid === params.itemUid)) : undefined;
  const isEdit = route.name === "BookmarkEdit";

  const [url, setUrl] = React.useState<string>(editing?.url ?? params.url ?? "");
  const [title, setTitle] = React.useState<string>(editing?.title ?? params.title ?? "");
  const [note, setNote] = React.useState<string>(editing?.note ?? "");
  const [tags, setTags] = React.useState<string[]>(editing?.tags ?? []);
  const [colUid, setColUid] = React.useState<string | undefined>(editing?.colUid);
  const [clipboardUrl, setClipboardUrl] = React.useState<string>();
  const [fetching, setFetching] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const keyboard = useKeyboardHeight();

  // A new bookmark of a link that was saved already changes that one
  const existing = (!isEdit && (url.trim() !== "")) ? bookmarks.find((x) => comparableUrl(x.url) === comparableUrl(url)) : undefined;
  const target = editing ?? existing;
  const valid = isValidUrl(url);

  // Opened again with another link (e.g. shared while the form was open), which replaces what's there
  const firstParams = React.useRef(true);
  React.useEffect(() => {
    if (firstParams.current) {
      firstParams.current = false;
      return;
    }
    if (!isEdit && params.url) {
      setUrl(params.url);
      setTitle(params.title ?? "");
      setNote("");
      setTags([]);
    }
  }, [params.url, params.title]);

  // A link that's saved already: what's empty is filled in from that bookmark, which saving changes
  React.useEffect(() => {
    if (existing) {
      setTitle((x) => x || existing.title);
      setNote((x) => x || existing.note);
      setTags((x) => (x.length > 0) ? x : existing.tags);
    }
  }, [existing?.uid]);

  React.useEffect(() => {
    navigation.setOptions({ title: (isEdit) ? "Edit bookmark" : "New bookmark" });
  }, [navigation, isEdit]);

  // A link on the clipboard is offered, as that's usually why a bookmark is added (only on phones:
  // browsers ask for the permission to read it)
  React.useEffect(() => {
    if (isEdit || params.url || (Platform.OS === "web")) {
      return;
    }
    Clipboard.getStringAsync().then((text) => {
      const found = findUrl(text ?? "");
      if (found && !bookmarks.some((x) => comparableUrl(x.url) === comparableUrl(found))) {
        setClipboardUrl(found);
      }
    }).catch(() => undefined);
  }, []);

  if (syncGate) {
    return syncGate;
  }
  if (isEdit && !editing) {
    return <NotFound />;
  }

  async function getTitle() {
    setFetching(true);
    try {
      const found = await fetchTitle(url);
      if (found) {
        setTitle(found);
      } else {
        dispatch(pushMessage({ message: "The page has no title", severity: "warning" }) as any);
      }
    } catch (e) {
      dispatch(pushMessage({ message: `Couldn't read the page's title (${(e as Error).message})`, severity: "warning" }) as any);
    }
    setFetching(false);
  }

  async function save() {
    if (!valid || saving) {
      return;
    }
    setSaving(true);
    const data: BookmarkData = { url, title, note, tags };
    try {
      if (target) {
        await updateBookmark(etebase!, target, data, colUid);
      } else {
        await createBookmark(etebase!, data, "android", colUid);
      }
      goUp(navigation, route);
    } catch (e) {
      dispatch(pushMessage({ message: `Couldn't save the bookmark: ${(e as Error).message}`, severity: "error" }) as any);
      setSaving(false);
    }
  }

  async function remove() {
    await deleteBookmark(etebase!, editing!);
    dispatch(pushMessage({ message: "Bookmark deleted", severity: "success" }) as any);
    goUp(navigation, route);
  }

  return (
    // (moved up by the keyboard, so that the save button stays above it)
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingBottom: keyboard }}>
      <ScrollView keyboardAware keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
        {(clipboardUrl && (url.trim() === "")) && (
          <View style={[styles.clipboard, { backgroundColor: theme.colors.accentTint, borderColor: theme.colors.accentRing }]}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={20} color={theme.colors.accent} />
            <View style={styles.grow}>
              <Text style={[styles.small, { color: theme.colors.textSecondary }]}>Link on your clipboard</Text>
              <Text style={[styles.small, { color: theme.colors.text }]} numberOfLines={1}>{clipboardUrl.replace(/^https?:\/\//, "")}</Text>
            </View>
            <TouchableRipple
              borderless
              onPress={() => setUrl(clipboardUrl)}
              accessibilityRole="button"
              accessibilityLabel="Use the link on the clipboard"
              style={[styles.smallButton, { backgroundColor: theme.colors.accent }]}
            >
              <Text style={[styles.smallButtonText, { color: theme.colors.onAccent }]}>Use</Text>
            </TouchableRipple>
          </View>
        )}

        <Field
          label="Link"
          value={url}
          onChangeText={setUrl}
          placeholder="https://"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={!isEdit && !params.url}
          mono
        />

        {(url.trim() !== "") && (
          <View style={[styles.site, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <SiteTile url={normalizeUrl(url)} size={40} />
            <View style={styles.grow}>
              <Text style={[styles.siteName, { color: theme.colors.text }]} numberOfLines={1}>{domainOf(normalizeUrl(url))}</Text>
              {(Platform.OS !== "web") && (
                <Text style={[styles.small, { color: theme.colors.textMuted }]}>Getting the title contacts this site</Text>
              )}
            </View>
            {(Platform.OS !== "web") && (
              (fetching) ? <ActivityIndicator style={styles.smallButton} /> : (
                <TouchableRipple
                  borderless
                  disabled={!valid}
                  onPress={getTitle}
                  accessibilityRole="button"
                  accessibilityLabel="Get the title from the page"
                  style={[styles.smallButton, styles.outlined, { borderColor: theme.colors.border }]}
                >
                  <Text style={[styles.smallButtonText, { color: theme.colors.text }]}>Get title</Text>
                </TouchableRipple>
              )
            )}
          </View>
        )}

        {existing && <DuplicateNotice existing={existing} />}

        <Field label="Title" value={title} onChangeText={setTitle} placeholder={(url.trim()) ? domainOf(normalizeUrl(url)) : "The name of the page"} />
        <Field label="Note" optional value={note} onChangeText={setNote} placeholder="Why you saved it" multiline />
        <TagPicker value={tags} onChange={setTags} known={knownTags} />
        <CollectionPicker collections={collections} value={colUid ?? target?.colUid} onChange={setColUid} />

        {editing && (
          <View style={styles.editInfo}>
            <Text style={[styles.small, { color: theme.colors.textMuted }]}>
              Saved {format(editing.created, "PP")}{(savedFromLabel(editing.savedFrom)) ? ` ${savedFromLabel(editing.savedFrom)}` : ""}{(editing.mtime - editing.created > 60000) ? ` · last changed ${format(editing.mtime, "PP")}` : ""}
            </Text>
            <TouchableRipple
              borderless
              onPress={remove}
              accessibilityRole="button"
              style={[styles.delete, { borderColor: theme.colors.error }]}
            >
              <View style={styles.deleteInner}>
                <MaterialCommunityIcons name="delete-outline" size={18} color={theme.colors.error} />
                <Text style={[styles.deleteText, { color: theme.colors.error }]}>Delete bookmark</Text>
              </View>
            </TouchableRipple>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
        <TouchableRipple
          borderless
          disabled={!valid || saving}
          onPress={save}
          accessibilityRole="button"
          style={[styles.save, { backgroundColor: (valid) ? theme.colors.accent : theme.colors.field }]}
        >
          <Text style={[styles.saveText, { color: (valid) ? theme.colors.onAccent : theme.colors.textMuted }]}>
            {(isEdit) ? "Save changes" : (existing) ? "Update bookmark" : "Save bookmark"}
          </Text>
        </TouchableRipple>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    padding: 18,
    gap: 18,
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  small: {
    fontSize: 12,
  },
  clipboard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    paddingLeft: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  smallButton: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 9,
    justifyContent: "center",
  },
  smallButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  outlined: {
    borderWidth: 1,
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
  editInfo: {
    gap: 10,
    paddingTop: 4,
  },
  delete: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
  },
  deleteInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  deleteText: {
    fontFamily: fonts.medium,
    fontSize: 15,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  save: {
    width: "100%",
    maxWidth: 604,
    alignSelf: "center",
    height: 50,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  saveText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
});
