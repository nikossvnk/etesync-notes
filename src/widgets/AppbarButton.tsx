// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import { Tooltip } from "react-native-paper";

import { useDeviceBreakpoint } from "../helpers";
import AppbarAction from "./AppbarAction";

// Wide screens have room for all of the actions of a screen in its bar, instead of a menu
export function useWideAppbar() {
  return useDeviceBreakpoint("tabletLandscape");
}

interface PropsType {
  icon: string;
  // Shown when hovering, and the label for screen readers
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

// An action in the bar of a screen, with its title as a tooltip
export default function AppbarButton(props: PropsType) {
  const { icon, title, onPress, disabled } = props;

  return (
    <Tooltip title={title}>
      <AppbarAction icon={icon} accessibilityLabel={title} disabled={disabled} onPress={onPress} />
    </Tooltip>
  );
}
