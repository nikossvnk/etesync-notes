// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import { BackHandler, Linking, StatusBar } from "react-native";
import { Provider as PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useAppTheme } from "./App";
import ErrorBoundary from "./ErrorBoundary";
import SettingsGate from "./SettingsGate";
import { Shared, ShareSheet } from "./screens/BookmarkShareScreen";

const scheme = "com.etesync.notes://";

// What Android's share target (ShareActivity) shows: only the sheet to save the shared link, over
// the app it was shared from. Closing it goes back to that app.
function InnerShareApp(props: { share: Shared }) {
  const { theme, ready } = useAppTheme();
  if (!ready) {
    return null;
  }

  // (the activity finishes on the back action, see ShareActivity)
  const close = () => BackHandler.exitApp();
  // Opens a screen of the app itself, and closes the sheet
  const openApp = (path: string) => {
    Linking.openURL(scheme + path).catch(() => undefined).finally(close);
  };

  return (
    <PaperProvider theme={theme}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ErrorBoundary>
        <SettingsGate>
          <ShareSheet
            shared={props.share}
            onClose={close}
            onOpenBookmarks={() => openApp("bookmarks")}
            onMoreOptions={({ url, title }) => openApp(`new-bookmark?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`)}
            onLogin={() => openApp("")}
          />
        </SettingsGate>
      </ErrorBoundary>
    </PaperProvider>
  );
}

export default function ShareApp(props: { share: Shared }) {
  return (
    <SafeAreaProvider>
      <InnerShareApp share={props.share} />
    </SafeAreaProvider>
  );
}
