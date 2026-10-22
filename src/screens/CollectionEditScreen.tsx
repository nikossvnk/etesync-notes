// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { useSelector } from "react-redux";
import { TextInput as NativeTextInput } from "react-native";
import { HelperText, Paragraph } from "react-native-paper";
import { useNavigation, RouteProp, useNavigationState, CommonActions } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";

import { useSyncGate } from "../SyncGate";
import { goUp } from "../navigation";
import { useCredentials } from "../credentials";
import { StoreState, useAsyncDispatch } from "../store";
import { pushMessage } from "../store/actions";
import { bookmarksSelector } from "../store/selectors";
import { saveCollectionLocally, deleteCollectionLocally } from "../sync/SyncManager";

import TextInput from "../widgets/TextInput";
import ScrollView from "../widgets/ScrollView";
import Container from "../widgets/Container";
import ConfirmationDialog from "../widgets/ConfirmationDialog";
import ErrorOrLoadingDialog from "../widgets/ErrorOrLoadingDialog";
import NotFound from "../widgets/NotFound";
import FormButton from "../widgets/FormButton";
import AppbarAction from "../widgets/AppbarAction";

import { useLoading, defaultColor } from "../helpers";
import { DefaultNavigationProp, RootStackParamList } from "../RootStackParamList";

import ColorPicker from "../widgets/ColorPicker";
import * as C from "../constants";

interface FormErrors {
  name?: string;
  color?: string;
}

type RouteName = "CollectionEdit" | "CollectionCreate" | "BookmarkListEdit" | "BookmarkListCreate";
type NavigationProp = StackNavigationProp<RootStackParamList, RouteName>;

interface PropsType {
  route: RouteProp<RootStackParamList, RouteName>;
}

// What a notebook or a bookmark list is called, as both are made and changed here
function nounOf(bookmarks: boolean) {
  return (bookmarks) ? "Bookmark list" : "Notebook";
}

// Makes or changes a notebook or a bookmark list (both are collections with a name, a description and a colour)
export default function CollectionEditScreen(props: PropsType) {
  const [errors, setErrors] = React.useState({} as FormErrors);
  const [name, setName] = React.useState<string>("");
  const [description, setDescription] = React.useState<string>("");
  const [color, setColor] = React.useState<string>("");
  const dispatch = useAsyncDispatch();
  const cacheCollections = useSelector((state: StoreState) => state.cache.collections);
  const syncGate = useSyncGate();
  const navigation = useNavigation<NavigationProp>();
  const navigationState = useNavigationState((state) => (state.index > 0) ? state.routes[state.index - 1] : null);
  const etebase = useCredentials()!;
  const [loading, error, setPromise] = useLoading();
  const bookmarks = props.route.name.startsWith("BookmarkList");
  const colType = (bookmarks) ? C.bookmarkColType : C.colType;
  const noun = nounOf(bookmarks);

  const colUid = props.route.params?.colUid;
  React.useEffect(() => {
    if (syncGate) {
      return;
    }

    if (colUid) {
      const passedCollection = cacheCollections.get(colUid);
      if (passedCollection) {
        const { meta } = passedCollection;
        setName(meta.name!);
        setDescription(meta.description ?? "");
        if (meta.color !== undefined) {
          setColor(meta.color);
        }
      }
    }

  }, [syncGate, colUid]);

  React.useEffect(() => {
    navigation.setOptions({
      title: `${(colUid) ? "Edit" : "New"} ${noun.toLowerCase()}`,
      headerRight: () => (
        <RightAction colUid={colUid} bookmarks={bookmarks} />
      ),
    });
  }, [colUid, bookmarks]);

  if (syncGate) {
    return syncGate;
  }

  if (colUid && !cacheCollections.has(colUid)) {
    return <NotFound />;
  }

  function onSave() {
    setPromise(async () => {
      const saveErrors: FormErrors = {};
      const fieldRequired = "This field is required!";

      if (!name) {
        saveErrors.name = fieldRequired;
      }

      if (color && !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)) {
        saveErrors.color = "Must be of the form #RRGGBB or #RRGGBBAA or empty";
      }

      if (Object.keys(saveErrors).length > 0) {
        setErrors(saveErrors);
        return;
      }

      const colMgr = etebase.getCollectionManager();
      const mtime = (new Date()).getTime();
      const meta = { name, description, color, mtime };
      let collection;
      if (colUid) {
        collection = colMgr.cacheLoad(cacheCollections.get(colUid)!.cache);
        const colMeta = collection.getMeta();
        collection.setMeta({ ...colMeta, ...meta });
      } else {
        collection = await colMgr.create(colType, meta, "");
      }

      await saveCollectionLocally(etebase, colMgr, collection, !colUid);
      if (colUid) {
        dispatch(pushMessage({ message: `${noun} saved`, severity: "success" }));
        goUp(navigation, props.route);
      } else if (bookmarks) {
        dispatch(pushMessage({ message: `${noun} created`, severity: "success" }));
        navigation.replace("BookmarkList", { colUid: collection.uid });
      } else {
        dispatch(pushMessage({ message: `${noun} created`, severity: "success" }));

        const previousScreen = navigationState?.name;
        if (navigationState && previousScreen === "NoteCreate") {
          // We change the colUid 
          navigation.dispatch({
            ...CommonActions.setParams({ colUid: collection.uid }),
            source: navigationState.key,
          });
          // Back to the new note, which is created in it
          goUp(navigation, props.route);
        } else {
          // We're gonna navigate to the notebook's page
          navigation.replace("Collection", { colUid: collection.uid });
        }
      }
    });
  }

  const descriptionRef = React.createRef<NativeTextInput>();

  const collectionColorBox = (
    <>
      <ColorPicker
        error={errors.color}
        defaultColor={defaultColor}
        color={color}
        onChange={setColor}
      />
    </>
  );

  return (
    <ScrollView keyboardAware>
      <Container>
        <ErrorOrLoadingDialog
          loading={loading}
          error={error}
          onDismiss={() => setPromise(undefined)}
        />
        <TextInput
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => descriptionRef.current!.focus()}
          error={!!errors.name}
          onChangeText={setName}
          label="Display name (title)"
          accessibilityLabel="Display name (title)"
          value={name}
        />
        <HelperText
          type="error"
          visible={!!errors.name}
        >
          {errors.name}
        </HelperText>

        <TextInput
          ref={descriptionRef}
          onChangeText={setDescription}
          label="Description (optional)"
          accessibilityLabel="Description (optional)"
          value={description}
        />
        <HelperText
          type="error"
          visible={false}
        >
          <React.Fragment />
        </HelperText>

        {collectionColorBox}

        <FormButton
          disabled={loading}
          onPress={onSave}
        >
          {loading ? "Loading…" : "Save"}
        </FormButton>
      </Container>
    </ScrollView>
  );
}

function RightAction(props: { colUid: string | undefined, bookmarks: boolean }) {
  const [confirmationVisible, setConfirmationVisible] = React.useState(false);
  const navigation = useNavigation<DefaultNavigationProp>();
  const etebase = useCredentials()!;
  const dispatch = useAsyncDispatch();
  const cacheCollections = useSelector((state: StoreState) => state.cache.collections);
  const { colUid, bookmarks } = props;
  const bookmarkCount = useSelector((state: StoreState) => (colUid) ? bookmarksSelector(state).get(colUid)?.count((x) => !x.isDeleted) ?? 0 : 0);
  const noun = nounOf(bookmarks);

  if (!colUid) {
    return <React.Fragment />;
  }

  return (
    <React.Fragment>
      <AppbarAction
        icon="delete"
        accessibilityLabel={`Delete ${noun.toLowerCase()}`}
        onPress={() => {
          setConfirmationVisible(true);
        }}
      />
      <ConfirmationDialog
        title="Are you sure?"
        key={confirmationVisible.toString()}
        visible={confirmationVisible}
        onOk={async () => {
          const colMgr = etebase.getCollectionManager();
          const collection = colMgr.cacheLoad(cacheCollections.get(colUid)!.cache);
          const mtime = (new Date()).getTime();
          const meta = collection.getMeta();
          collection.setMeta({ ...meta, mtime });
          collection.delete();
          deleteCollectionLocally(etebase, colMgr, collection);
          setConfirmationVisible(false);
          dispatch(pushMessage({ message: `${noun} deleted`, severity: "success" }));
          if (bookmarks) {
            // Back to where the list was opened from
            const opened = navigation.getState()?.routes.some((x) => x.name === "BookmarkLists");
            navigation.popTo((opened) ? "BookmarkLists" : "Bookmarks");
          } else {
            navigation.popTo("Home");
          }
        }}
        onCancel={() => {
          setConfirmationVisible(false);
        }}
      >
        <Paragraph>
          {(!bookmarks) ? "This notebook and all of its notes will be removed from the server." :
            (bookmarkCount === 0) ? "This bookmark list will be removed from the server." :
              `This bookmark list and its ${(bookmarkCount === 1) ? "bookmark" : `${bookmarkCount} bookmarks`} will be removed from the server.`}
        </Paragraph>
      </ConfirmationDialog>
    </React.Fragment>
  );
}
