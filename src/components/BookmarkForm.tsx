// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Platform, StyleSheet, TextInput, TextInputProps, View } from "react-native";
import { Text, TouchableRipple } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { format } from "date-fns";

import { Bookmark, normalizeTag } from "../bookmarks";
import { fonts, useTheme } from "../theme";

// A labelled text field of the bookmark forms
export const Field = React.forwardRef(function Field(props: TextInputProps & { label: string, optional?: boolean, mono?: boolean }, ref: React.Ref<TextInput>) {
  const theme = useTheme();
  const [focused, setFocused] = React.useState(false);
  const { label, optional, mono, style, multiline, ...rest } = props;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
        {label}
        {optional && <Text style={{ color: theme.colors.textMuted, fontFamily: fonts.regular }}>{"  optional"}</Text>}
      </Text>
      <TextInput
        ref={ref}
        {...rest}
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.textMuted}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true); rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false); rest.onBlur?.(e);
        }}
        style={[styles.input, (multiline) && styles.multiline, {
          color: theme.colors.text,
          backgroundColor: theme.colors.background,
          borderColor: (focused) ? theme.colors.accent : theme.colors.border,
        // (a ring around the focused field on the web: on Android a shadow on a field loses its padding)
        }, (focused && (Platform.OS === "web")) && { boxShadow: `0 0 0 3px ${theme.colors.accentRing}` } as any, (mono) && styles.mono, style]}
      />
    </View>
  );
});

// The tags of a bookmark: the chosen ones (which can be taken out), the ones of other bookmarks to
// add with a press, and a field for a new one
export function TagPicker(props: { value: string[], onChange: (tags: string[]) => void, known: string[], max?: number }) {
  const theme = useTheme();
  const [adding, setAdding] = React.useState("");
  const { value, onChange, known } = props;
  const suggestions = known.filter((x) => !value.includes(x)).slice(0, props.max ?? 6);

  function add(tag: string) {
    const name = normalizeTag(tag);
    if (name && !value.includes(name)) {
      onChange([...value, name]);
    }
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Tags</Text>
      <View style={styles.tags}>
        {value.map((tag) => (
          <View key={tag} style={[styles.tag, { backgroundColor: theme.colors.accentTint, borderColor: theme.colors.accent }]}>
            <Text style={[styles.tagText, { color: theme.colors.text }]}>#{tag}</Text>
            <TouchableRipple
              borderless
              onPress={() => onChange(value.filter((x) => x !== tag))}
              accessibilityRole="button"
              accessibilityLabel={`Remove tag ${tag}`}
              style={styles.tagRemove}
            >
              <MaterialCommunityIcons name="close" size={14} color={theme.colors.textSecondary} />
            </TouchableRipple>
          </View>
        ))}
        {suggestions.map((tag) => (
          <TouchableRipple
            key={tag}
            borderless
            onPress={() => add(tag)}
            accessibilityRole="button"
            accessibilityLabel={`Add tag ${tag}`}
            style={[styles.tag, styles.suggestion, { borderColor: theme.colors.disabled }]}
          >
            <Text style={[styles.tagText, { color: theme.colors.textSecondary }]}>+ {tag}</Text>
          </TouchableRipple>
        ))}
        <TextInput
          value={adding}
          onChangeText={(text) => {
            // A space or a comma ends a tag
            if (/[\s,]$/.test(text)) {
              add(text);
              setAdding("");
            } else {
              setAdding(text);
            }
          }}
          onSubmitEditing={() => {
            add(adding); setAdding("");
          }}
          onBlur={() => {
            add(adding); setAdding("");
          }}
          submitBehavior="submit"
          placeholder="New tag"
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel="New tag"
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.tag, styles.newTag, { color: theme.colors.text, borderColor: theme.colors.border }]}
        />
      </View>
    </View>
  );
}

// Which bookmark collection to save in, when there's more than one
export function CollectionPicker(props: { collections: { uid: string, name: string }[], value: string | undefined, onChange: (uid: string) => void }) {
  const theme = useTheme();
  const { collections, value, onChange } = props;
  if (collections.length < 2) {
    return null;
  }
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Save to</Text>
      <View style={styles.tags}>
        {collections.map((col) => {
          const selected = (value ?? collections[0].uid) === col.uid;
          return (
            <TouchableRipple
              key={col.uid}
              borderless
              onPress={() => onChange(col.uid)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              aria-checked={selected}
              accessibilityLabel={col.name}
              style={[styles.tag, {
                backgroundColor: (selected) ? theme.colors.chipActive : theme.colors.surface,
                borderColor: (selected) ? theme.colors.chipActive : theme.colors.border,
              }]}
            >
              <Text style={[styles.tagText, { color: (selected) ? theme.colors.onChipActive : theme.colors.text }]}>{col.name}</Text>
            </TouchableRipple>
          );
        })}
      </View>
    </View>
  );
}

// Says that the link was saved already, so saving changes that bookmark (rather than adding another)
export function DuplicateNotice(props: { existing: Bookmark }) {
  const theme = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: theme.colors.highlight, borderColor: theme.colors.border }]} accessibilityRole="alert">
      <MaterialCommunityIcons name="information-outline" size={18} color={theme.colors.text} />
      <Text style={[styles.noticeText, { color: theme.colors.text }]}>
        You saved this link on {format(props.existing.created, "PP")}. Saving it again updates that bookmark instead of adding a second one.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 10,
    outlineStyle: "none",
  } as any,
  multiline: {
    minHeight: 84,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },
  mono: {
    fontSize: 14,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 4,
  },
  tagText: {
    fontSize: 14,
  },
  tagRemove: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginLeft: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestion: {
    borderStyle: "dashed",
    paddingRight: 12,
  },
  newTag: {
    minWidth: 96,
    paddingRight: 12,
    fontSize: 14,
    fontFamily: fonts.regular,
    outlineStyle: "none",
  } as any,
  notice: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
