// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import { StyleSheet, View } from "react-native";
import { Text, TouchableRipple } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StackActions, useNavigation } from "@react-navigation/native";

import { fonts, useTheme } from "../theme";

type Section = "notes" | "bookmarks";

const sections: { key: Section, label: string, icon: string, route: string }[] = [
  { key: "notes", label: "Notes", icon: "note-text-outline", route: "Home" },
  { key: "bookmarks", label: "Bookmarks", icon: "bookmark-outline", route: "Bookmarks" },
];

// The two halves of the app, notes and bookmarks, as two tabs at the top of their lists
export default function SectionTabs(props: { current: Section }) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { current } = props;

  function open(route: string) {
    // One replaces the other, so that the back button doesn't go from one to the other
    navigation.dispatch(StackActions.replace(route));
  }

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.tabs, { backgroundColor: theme.colors.field, borderColor: theme.colors.border }]}
    >
      {sections.map((section) => {
        const selected = section.key === current;
        const color = (selected) ? theme.colors.text : theme.colors.textMuted;
        return (
          <TouchableRipple
            key={section.key}
            borderless
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            aria-selected={selected}
            accessibilityLabel={section.label}
            onPress={() => !selected && open(section.route)}
            style={[styles.tab, (selected) && { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          >
            <View style={styles.tabInner}>
              <MaterialCommunityIcons name={section.icon as any} size={17} color={(selected) ? theme.colors.accent : color} />
              <Text style={[styles.label, { color }, (selected) && styles.labelSelected]}>{section.label}</Text>
            </View>
          </TouchableRipple>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
    justifyContent: "center",
  },
  tabInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  labelSelected: {
    fontFamily: fonts.semibold,
  },
});
