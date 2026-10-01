import { MD2Colors as Colors, MD2DarkTheme as PaperDarkTheme, MD2LightTheme as PaperLightTheme, MD2Theme as PaperTheme, useTheme as usePaperTheme } from "react-native-paper";
import Color from "color";

export interface Theme extends PaperTheme {
  colors: PaperTheme["colors"] & {
    accentText: string;
    onAccent: string;
    active: string;
    activeIcon: string;
    activeBackground: string;
    inactiveIcon: string;
  };
}

const mainColors = {
  primary: Colors.amber500,
  accent: Colors.lightBlueA700, // Not the real etesync theme but better for accessibility
};

export const LightTheme: Theme = {
  ...PaperLightTheme,
  colors: {
    ...PaperLightTheme.colors,
    ...mainColors,
    accentText: Color(mainColors.accent).darken(0.2).rgb().string(),
    onAccent: "#FFFFFF",
    active: Color(mainColors.accent).darken(0.4).rgb().string(),
    activeIcon: Color(mainColors.accent).darken(0.2).rgb().string(),
    activeBackground: Color(mainColors.accent).alpha(0.12).rgb().string(),
    inactiveIcon: Color(PaperLightTheme.colors.onSurface).alpha(0.68).rgb().string(),
  },
};

export const DarkTheme: Theme = {
  ...PaperDarkTheme,
  colors: {
    ...PaperDarkTheme.colors,
    ...mainColors,
    accentText: Color(mainColors.accent).lighten(0.4).rgb().string(),
    onAccent: "#000000",
    active: Color(mainColors.accent).lighten(0.4).rgb().string(),
    activeIcon: mainColors.accent,
    activeBackground: Color(mainColors.accent).alpha(0.12).rgb().string(),
    inactiveIcon: Color(PaperDarkTheme.colors.onSurface).alpha(0.68).rgb().string(),
  },
};

export function useTheme() {
  return usePaperTheme() as Theme;
}