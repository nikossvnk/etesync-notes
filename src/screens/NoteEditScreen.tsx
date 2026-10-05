// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import * as Etebase from "etebase";
import { View, ViewProps, KeyboardAvoidingView, Platform } from "react-native";
import { Paragraph } from "react-native-paper";
import { useTheme } from "../theme";
import { useNavigation, RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useDebouncedCallback } from "use-debounce";

import { useSyncGate } from "../SyncGate";
import { goUp } from "../navigation";
import { StoreState, store, useAsyncDispatch } from "../store";
import ScrollView from "../widgets/ScrollView";
import RawTextInput from "../widgets/RawTextInput";
import { useCredentials } from "../credentials";

import Markdown from "../widgets/Markdown";
import { useSelector, useDispatch } from "react-redux";
import { pushMessage, setCacheItem, setSettings, setSyncItem, unsetCacheItem } from "../store/actions";
import { newNotes } from "../newNotes";
import { requestSync, saveItemsLocally } from "../sync/SyncManager";
import LoadingIndicator from "../widgets/LoadingIndicator";
import Menu from "../widgets/Menu";
import ConfirmationDialog from "../widgets/ConfirmationDialog";
import NotFound from "../widgets/NotFound";
import AppbarAction from "../widgets/AppbarAction";
import { fontFamilies } from "../helpers";
import { RootStackParamList } from "../RootStackParamList";
import { canShare, shareItem } from "../import-export";

type NavigationProp = StackNavigationProp<RootStackParamList, "NoteEdit">;

interface PropsType {
  route: RouteProp<RootStackParamList, "NoteEdit">;
}

export default function NoteEditScreen(props: PropsType) {
  const onLeaveRef = React.useRef<() => void>(null);
  // Whether the editor has content that was not yet written to the local cache
  const dirtyRef = React.useRef(false);
  // The note the editor content was loaded for
  const loadedKeyRef = React.useRef<string>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [content, setContent_] = React.useState("");
  const viewSettings = useSelector((state: StoreState) => state.settings.viewSettings);
  const { defaultViewMode, lastViewMode } = viewSettings;
  const [viewMode, setViewMode] = React.useState((defaultViewMode === "last") ? lastViewMode : (defaultViewMode === "viewer"));
  const [noteDeleteDialogShow, setNoteDeleteDialogShow] = React.useState(false);
  const dispatch = useAsyncDispatch();
  const syncDispatch = useDispatch();
  const syncItems = useSelector((state: StoreState) => state.sync.items);
  const cacheCollections = useSelector((state: StoreState) => state.cache.collections);
  const cacheItems = useSelector((state: StoreState) => state.cache.items);
  const etebase = useCredentials()!;
  const navigation = useNavigation<NavigationProp>();
  const syncGate = useSyncGate();

  const { colUid, itemUid } = props.route.params;
  const cacheCollection = (colUid) ? cacheItems.get(colUid) : undefined;
  const cacheItem = (cacheCollection && itemUid) ? cacheCollection.get(itemUid) : undefined;

  const changed = syncItems.hasIn([colUid, itemUid]);

  React.useEffect(() => {
    return () => {
      onLeaveRef.current?.();
    };
  }, []);

  React.useEffect(() => {
    navigation.setOptions({
      title: cacheItem?.meta.name ?? "Note Not Found",
      headerRight: () => (
        <RightAction
          viewMode={viewMode}
          setViewMode={setLastViewMode}
          onSave={onSave}
          onEdit={() => navigation.navigate("NoteProps", { colUid, itemUid })}
          onDelete={() => setNoteDeleteDialogShow(true)}
          onMove={() => navigation.navigate("NoteMove", { colUid, itemUid })}
          onShare={onShare}
          changed={changed}
        />
      ),
    });
  }, [navigation, colUid, cacheItem, viewMode, setLastViewMode, changed]);

  // Write the content to the local cache and queue the note to be pushed to the server
  async function saveLocally(content: string) {
    if (!etebase) {
      return;
    }
    dirtyRef.current = false;

    const colMgr = etebase.getCollectionManager();
    const col = colMgr.cacheLoad(cacheCollections.get(colUid)!.cache);
    const itemMgr = colMgr.getItemManager(col);

    for (;;) {
      const current = (store.getState() as unknown as StoreState).cache.items.get(colUid)?.get(itemUid);
      if (!current) {
        return;
      }
      const item = itemMgr.cacheLoad(current.cache);

      const meta = item.getMeta();
      meta.mtime = (new Date()).getTime();
      item.setMeta(meta);
      await item.setContent(content);

      // Start over if the cached note was replaced (e.g. by a sync) while we were working on it
      const latest = (store.getState() as unknown as StoreState).cache.items.get(colUid)?.get(itemUid);
      if (latest === current) {
        await dispatch(setCacheItem(col, itemMgr, item));
        syncDispatch(setSyncItem(colUid, itemUid) as any);
        return;
      }
    }
  }

  const persistItem = useDebouncedCallback(
    saveLocally,
    1000,
    // The max wait time:
    { maxWait: 10000 }
  );

  const cache = cacheItem?.cache;
  React.useEffect(() => {
    if (syncGate || !cacheItem) {
      return undefined;
    }

    const key = `${colUid}/${itemUid}`;
    // The cached note changes when we save it ourselves and when a sync updates it.
    // Only reload it when there is nothing local that would be lost.
    if ((loadedKeyRef.current === key) && (changed || dirtyRef.current)) {
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const colMgr = etebase.getCollectionManager();
      const col = colMgr.cacheLoad(cacheCollections.get(colUid)!.cache);
      const itemMgr = colMgr.getItemManager(col);
      const item = itemMgr.cacheLoad(cacheItem.cache);
      const content = await item.getContent(Etebase.OutputFormat.String);
      if (cancelled || ((loadedKeyRef.current === key) && dirtyRef.current)) {
        return;
      }
      const firstLoad = loadedKeyRef.current !== key;
      loadedKeyRef.current = key;
      setContent_(content);
      // There is nothing to view in an empty note (e.g. one that was just created), so start writing
      if (firstLoad && (content === "")) {
        setViewMode(false);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [syncGate, colUid, itemUid, cache]);

  function setContent(content: string) {
    dirtyRef.current = true;
    if (!changed) {
      syncDispatch(setSyncItem(colUid, itemUid) as any);
    }
    persistItem(content);
    setContent_(content);
  }

  async function onSaveDo() {
    persistItem.cancel();
    if (dirtyRef.current) {
      await saveLocally(content);
    }
    if (etebase) {
      requestSync(etebase, true);
    }
  }

  // Called when the screen is left: saves the note, or throws it away if it was just created and is still empty
  onLeaveRef.current = () => {
    if (!newNotes.has(itemUid)) {
      onSaveDo();
      return;
    }
    newNotes.delete(itemUid);
    if (content.trim() !== "") {
      onSaveDo();
      return;
    }

    persistItem.cancel();
    dirtyRef.current = false;
    if (!changed) {
      // It was never queued to be pushed, so it only exists here
      syncDispatch(unsetCacheItem(colUid, itemUid) as any);
    } else if (etebase && cacheItem) {
      // It got content that was removed again, and may already be on the server, so delete it there too
      const colMgr = etebase.getCollectionManager();
      const col = colMgr.cacheLoad(cacheCollections.get(colUid)!.cache);
      const itemMgr = colMgr.getItemManager(col);
      const item = itemMgr.cacheLoad(cacheItem.cache);
      item.delete(true);
      saveItemsLocally(etebase, col, itemMgr, [item]);
    }
    syncDispatch(pushMessage({ message: "Empty note discarded", severity: "info" }) as any);
  };

  function onSave() {
    onSaveDo();
  }

  function setLastViewMode(viewMode: boolean) {
    setViewMode(viewMode);
    syncDispatch(setSettings({
      viewSettings: {
        ...viewSettings,
        lastViewMode: viewMode,
      },
    }) as any);
  }

  function onShare() {
    (async () => {
      const colMgr = etebase.getCollectionManager();
      const col = colMgr.cacheLoad(cacheCollections.get(colUid)!.cache);
      const itemMgr = colMgr.getItemManager(col);
      const item = itemMgr.cacheLoad(cacheItem!.cache);
      await shareItem(item);
    })();
  }

  if (syncGate) {
    return syncGate;
  }
  
  if (!cacheCollection) {
    return <NotFound />;
  }
  if (!cacheItem) {
    return <NotFound message="This note can't be found" />;
  }

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <>
      {viewMode ? (
        <ScrollView keyboardAware contentContainerStyle={{ flexGrow: 1, padding: 10 }}>
          <Markdown
            setContent={setContent}
            content={content}
          />
        </ScrollView>
      ) : (
        <TextEditor
          style={{ flexGrow: 1 }}
          contentStyle={{ padding: 10 }}
          setContent={setContent}
          content={content}
        />
      )}
      <ConfirmationDialog
        title="Delete Note"
        visible={noteDeleteDialogShow}
        onOk={async () => {
          const colMgr = etebase.getCollectionManager();
          const col = colMgr.cacheLoad(cacheCollections.get(colUid)!.cache);
          const itemMgr = colMgr.getItemManager(col);
          const item = itemMgr.cacheLoad(cacheItem.cache);

          const meta = item.getMeta();
          meta.mtime = (new Date()).getTime();
          item.setMeta(meta);
          item.delete(true);

          persistItem.cancel();
          dirtyRef.current = false;
          await saveItemsLocally(etebase, col, itemMgr, [item]);
          goUp(navigation, props.route);
        }}
        onCancel={() => setNoteDeleteDialogShow(false)}
      >
        <Paragraph>Are you sure you would like to delete this note?</Paragraph>
      </ConfirmationDialog>
    </>
  );
}

interface RightActionViewProps {
  viewMode: boolean;
  changed: boolean;
  setViewMode: (value: boolean) => void;
  onEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onMove: () => void;
  onShare: () => void;
}

function RightAction({ viewMode, setViewMode, onSave, onEdit, onDelete, onMove, onShare, changed }: RightActionViewProps) {
  const [showMenu, setShowMenu] = React.useState(false);

  return (
    <View style={{ flexDirection: "row" }}>
      <AppbarAction icon={viewMode ? "pencil" : "eye"} accessibilityLabel="View mode" onPress={() => {
        setViewMode(!viewMode);
      }} />
      <Menu
        visible={showMenu}
        onDismiss={() => setShowMenu(false)}
        anchor={(
          <AppbarAction icon="dots-vertical" accessibilityLabel="Menu" onPress={() => setShowMenu(true)} />
        )}
      >
        <Menu.Item leadingIcon="pencil" title="Edit Properties"
          onPress={() => {
            setShowMenu(false);
            onEdit();
          }}
        />
        <Menu.Item leadingIcon="delete" title="Delete"
          onPress={() => {
            setShowMenu(false);
            onDelete();
          }}
        />
        <Menu.Item leadingIcon="share" title="Move"
          onPress={() => {
            setShowMenu(false);
            onMove();
          }}
        />
        <Menu.Item leadingIcon="content-save" title="Save"
          disabled={!changed}
          onPress={() => {
            setShowMenu(false);
            onSave();
          }}
        />
        {(canShare()) ? (
          <Menu.Item leadingIcon="share-variant" title="Share"
            onPress={() => {
              setShowMenu(false);
              onShare();
            }}
          />
        ) : null}
      </Menu>
    </View>
  );
}

interface TextEditorPropsType extends ViewProps {
  content: string;
  setContent: (value: string) => void;
  contentStyle?: ViewProps["style"];
}

function TextEditor(props: TextEditorPropsType) {
  const { content, setContent } = props;
  const fontSize = useSelector((state: StoreState) => state.settings.fontSize);
  const fontFamilyKey = useSelector((state: StoreState) => state.settings.viewSettings.editorFontFamily);
  const fontFamily = fontFamilies[fontFamilyKey];
  const theme = useTheme();

  return (
    <KeyboardAvoidingView
      behavior="padding"
      enabled={(Platform.OS === "ios")}
      style={[{ backgroundColor: theme.colors.background }, props.style]}
    >
      <RawTextInput
        textAlignVertical="top"
        multiline
        scrollEnabled
        style={[{ flexGrow: 1, fontSize, fontFamily }, props.contentStyle]}
        onChangeText={setContent}
        value={content}
      />
    </KeyboardAvoidingView>
  );
}
