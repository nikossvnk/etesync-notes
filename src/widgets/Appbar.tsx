import * as React from "react";
import { StackHeaderProps } from "@react-navigation/stack";
import { Appbar as PaperAppbar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MenuButton from "./MenuButton";

export default function Appbar(props: StackHeaderProps & { menuFallback: boolean }) {
  const { menuFallback, navigation, back, options, route } = props;
  const insets = useSafeAreaInsets();
  const title = options.headerTitle ?? options.title ?? route.name;
  let left: React.ReactNode = null;
  if (options.headerLeft) {
    left = options.headerLeft({ canGoBack: !!back });
  } else if (back) {
    left = <PaperAppbar.BackAction containerColor="transparent" onPress={navigation.goBack} />;
  } else if (menuFallback) {
    left = <MenuButton />;
  }
  const right = options.headerRight?.({ canGoBack: !!back });

  return (
    <PaperAppbar.Header statusBarHeight={insets.top}>
      {left}
      {(typeof title === "string") ? (
        <PaperAppbar.Content title={title} />
      ) : title({ children: route.name })}
      {right}
    </PaperAppbar.Header>
  );
}
