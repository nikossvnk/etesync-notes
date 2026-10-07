import * as React from "react";
import { I18nManager, StyleSheet, TextInput } from "react-native";
import { Appbar } from "react-native-paper";
import { fonts, useTheme } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MenuButton from "./MenuButton";
import { headerStyle } from "./Appbar";

type PropsType = {
  value: string;
  onChangeText: (query: string) => void;
};

export default function SearchToolbar(props: PropsType) {
  const { value, onChangeText } = props;
  const theme = useTheme();
  const textColor = theme.colors.text;
  const inputRef = React.useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  return (
    <Appbar.Header statusBarHeight={insets.top} style={headerStyle(theme)}>
      <MenuButton />
      <Appbar.Action
        containerColor="transparent"
        disabled
        color={theme.colors.textMuted}
        icon="magnify"
      />
      <TextInput
        ref={inputRef}
        placeholder="Search"
        value={value}
        onChangeText={onChangeText}
        autoFocus
        style={[styles.input, { color: textColor }]}
        placeholderTextColor={theme.colors.placeholder}
        selectionColor={theme.colors.primary}
        underlineColorAndroid="transparent"
        returnKeyType="search"
        keyboardAppearance={theme.dark ? "dark" : "light"}
        accessibilityRole="search"
      />
      <Appbar.Action
        containerColor="transparent"
        color={theme.colors.text}
        disabled={!value}
        icon="close"
        onPress={() => {
          inputRef.current?.clear();
          onChangeText("");
        }}
      />
    </Appbar.Header>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    fontSize: 18,
    paddingLeft: 8,
    alignSelf: "stretch",
    textAlign: I18nManager.isRTL ? "right" : "left",
    minWidth: 0,
    fontFamily: fonts.regular,
    // The bar shows where the text goes already
    outlineStyle: "none",
  } as any,
});