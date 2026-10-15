// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Modal, Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";

interface PropsType {
  visible: boolean;
  onDismiss: () => void;
  // What it is, for screen readers
  label: string;
  // "menu" for a list of actions
  role?: "menu" | "dialog";
  style?: ViewStyle;
}

// A sheet that comes up from the bottom of the screen over a dimmed background. A press on the
// background, or the back button, closes it.
export default function BottomSheet(props: React.PropsWithChildren<PropsType>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { visible, onDismiss, label, role, style, children } = props;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.container}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          role={role ?? "dialog"}
          aria-label={label}
          aria-modal
          style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, paddingBottom: 16 + insets.bottom }, style]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.disabled }]} aria-hidden />
          {children}
        </View>
      </View>
    </Modal>
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
    alignSelf: "center",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
    opacity: 0.6,
  },
});
