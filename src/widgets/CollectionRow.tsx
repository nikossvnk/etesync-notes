import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import GroupedRow from "./GroupedRow";
import { defaultColor } from "../helpers";
import { fonts, useTheme } from "../theme";

interface PropsType {
  name: string;
  description?: string;
  color?: string;
  // How many notes or bookmarks it has
  count: number;
  first: boolean;
  last: boolean;
  onPress: () => void;
}

// A notebook or a bookmark list, in the list of them
export default function CollectionRow(props: PropsType) {
  const theme = useTheme();
  const { name, description, color, count, first, last, onPress } = props;

  return (
    <GroupedRow
      first={first}
      last={last}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.rowInner}>
        <View style={[styles.color, { backgroundColor: color || defaultColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>{name}</Text>
          {!!description && (
            <Text style={[styles.description, { color: theme.colors.textSecondary }]} numberOfLines={2}>{description}</Text>
          )}
        </View>
        <Text style={[styles.count, { color: theme.colors.textMuted }]}>{count}</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.textMuted} />
      </View>
    </GroupedRow>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 14,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  color: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: 12,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  description: {
    fontSize: 13,
    marginTop: 2,
  },
  count: {
    fontSize: 13,
    marginLeft: 8,
    marginRight: 2,
  },
});
