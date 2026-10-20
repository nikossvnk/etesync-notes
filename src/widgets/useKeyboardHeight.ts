// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Keyboard, Platform } from "react-native";

// How much of the bottom of the screen the keyboard covers, on Android. The window isn't made smaller
// for the keyboard there (as the app is drawn behind the system's bars), so what's at the bottom of a
// screen (like a save button) needs to be moved up by this much to stay in sight.
export default function useKeyboardHeight() {
  const [height, setHeight] = React.useState(0);
  React.useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }
    const show = Keyboard.addListener("keyboardDidShow", (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove(); hide.remove();
    };
  }, []);
  return height;
}
