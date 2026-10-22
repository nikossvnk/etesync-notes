// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Text, TouchableRipple } from "react-native-paper";

import { defaultColor } from "../helpers";
import { fonts, useTheme } from "../theme";

interface ChipPropsType {
  label: string;
  color?: string;
  selected: boolean;
  onPress: () => void;
}

function Chip(props: ChipPropsType) {
  const theme = useTheme();
  const { label, color, selected, onPress } = props;

  return (
    <TouchableRipple
      borderless
      style={[styles.chip, {
        backgroundColor: (selected) ? theme.colors.chipActive : theme.colors.surface,
        borderColor: (selected) ? theme.colors.chipActive : theme.colors.border,
      }]}
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      accessibilityState={{ selected }}
      onPress={onPress}
    >
      <View style={styles.chipContent}>
        {color && (
          <View style={[styles.chipColor, { backgroundColor: color }]} />
        )}
        <Text style={[styles.label, (selected) ? { color: theme.colors.onChipActive, fontFamily: fonts.medium } : { color: theme.colors.text }]} numberOfLines={1}>{label}</Text>
      </View>
    </TouchableRipple>
  );
}

interface PropsType {
  // The notebooks or bookmark lists, in the order they're shown in
  collections: { uid: string, name: string, color?: string }[];
  // The uid of the one that is filtered by, if any
  value: string | undefined;
  onChange: (colUid: string | undefined) => void;
  // The chip of all of them ("All", or more when there are other chips next to these)
  allLabel?: string;
  style?: StyleProp<ViewStyle>;
}

// A row of chips to choose which notebook's notes (or which list's bookmarks) to show
export default function CollectionFilter(props: PropsType) {
  const theme = useTheme();
  const { collections, value, onChange } = props;

  // Nothing to choose from
  if (collections.length < 2) {
    return null;
  }

  return (
    <View style={[{ backgroundColor: theme.colors.background }, props.style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}
      >
        <Chip label={props.allLabel ?? "All"} selected={!value} onPress={() => onChange(undefined)} />
        {collections.map((col) => (
          <Chip
            key={col.uid}
            label={col.name}
            color={col.color || defaultColor}
            selected={value === col.uid}
            onPress={() => onChange((value === col.uid) ? undefined : col.uid)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 2,
  },
  chip: {
    height: 36,
    maxWidth: 220,
    marginRight: 8,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
  },
  chipContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  label: {
    fontSize: 14,
  },
  chipColor: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: 7,
  },
});
