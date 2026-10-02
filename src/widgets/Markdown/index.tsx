// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Image, Linking, StyleSheet, View, ViewProps } from "react-native";
import { ActivityIndicator, Checkbox, Text, TouchableRipple } from "react-native-paper";
import { Theme, useTheme } from "../../theme";
import MarkdownDisplay, { MarkdownIt, renderRules, RenderRules } from "react-native-markdown-display";
import { useSelector } from "react-redux";
import { fontFamilies, FontFamilyKey } from "../../helpers";
import { StoreState } from "../../store";
import TaskList from "./markdown-it-tasklist";
import toggleCheckbox from "./toggle-checkbox";

const getStyles = (theme: Theme, fontSize: number, fontFamilyKey: FontFamilyKey) => {
  const defaults = {
    header: {
      fontWeight: "bold",
      marginTop: 20,
      marginBottom: 10,
    },
    margin: 16,
  };

  const extraColors = (theme.dark) ? {
    border: "#555",
    blockBackground: "#333",
    blockText: "#ddd",
    link: "#628EF7",
  } : {
    border: "#ccc",
    blockBackground: "#ddd",
    blockText: "#333",
    link: "#0366d6",
  };

  return StyleSheet.create({
    body: {
      color: theme.colors.onSurface,
      fontSize,
      fontFamily: fontFamilies[fontFamilyKey],
    },
    heading1: {
      ...defaults.header,
      borderBottomColor: extraColors.border,
      borderBottomWidth: 1,
      fontSize: fontSize * 2,
      lineHeight: fontSize * 4,
    },
    heading2: {
      ...defaults.header,
      borderBottomColor: extraColors.border,
      borderBottomWidth: 1,
      fontSize: fontSize * 1.5,
      lineHeight: fontSize * 3,
    },
    heading3: {
      ...defaults.header,
      fontSize: fontSize * 1.25,
      lineHeight: fontSize * 2,
    },
    heading4: {
      ...defaults.header,
      fontSize: fontSize,
    },
    heading5: {
      ...defaults.header,
      fontSize: fontSize * 0.875,
    },
    heading6: {
      ...defaults.header,
      fontSize: fontSize * 0.825,
    },
    hr: {
      backgroundColor: extraColors.border,
      height: 3,
      marginVertical: 20,
    },
    blockquote: {
      backgroundColor: "transparent",
      borderColor: extraColors.border,
      fontStyle: "italic",
      marginBottom: defaults.margin,
      paddingTop: defaults.margin,
      paddingHorizontal: defaults.margin,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: defaults.margin,
    },
    link: {
      color: extraColors.link,
      textDecorationLine: "underline",
    },
    blocklink: {
      borderColor: extraColors.link,
    },
    code_inline: {
      backgroundColor: extraColors.blockBackground,
      borderWidth: 0,
      color: extraColors.blockText,
      fontFamily: fontFamilies.monospace,
      padding: 3,
    },
    code_block: {
      backgroundColor: extraColors.blockBackground,
      borderColor: extraColors.border,
      color: extraColors.blockText,
      fontFamily: fontFamilies.monospace,
      marginBottom: defaults.margin,
      padding: defaults.margin,
    },
    fence: {
      backgroundColor: extraColors.blockBackground,
      borderColor: extraColors.border,
      color: extraColors.blockText,
      fontFamily: fontFamilies.monospace,
      marginBottom: defaults.margin,
      padding: defaults.margin,
    },
    table: {
      borderColor: extraColors.border,
      borderRightWidth: 0,
    },
    thead: {},
    tbody: {},
    th: {
      backgroundColor: extraColors.blockBackground,
      borderColor: extraColors.border,
      borderRightWidth: 1,
      fontWeight: "bold",
      textAlign: "center",
    },
    tr: {
      borderColor: extraColors.border,
    },
    td: {
      borderColor: extraColors.border,
      borderRightWidth: 1,
    },
    remoteImage: {
      borderColor: extraColors.border,
      borderWidth: 1,
      borderRadius: 4,
      borderStyle: "dashed",
      marginVertical: 4,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    tasklistItem: {
      display: "flex",
      flexDirection: "row",
    },
    tasklistTextgroup: {
      fontSize: 16, // Same as in Checkbox.Item
      minHeight: 36, // Same as Checkbox.Android
      paddingVertical: 6, // Same as Checkbox.Android
      display: "flex", // The rest is to center on web
      flex: 1,
      alignItems: "center",
    },
  });
};

// The images that the user chose to load
const loadedImages = new Set<string>();

// Shows an image in its own size, or scaled down to the available width
function NoteImage(props: { src: string, alt?: string }) {
  const { src, alt } = props;
  const [size, setSize] = React.useState<{ width: number, height: number }>();
  const [failed, setFailed] = React.useState(false);
  // Whether to find out the size by loading the image, when asking for the size didn't work
  const [measure, setMeasure] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setSize(undefined);
    setFailed(false);
    setMeasure(false);
    Image.getSize(src, (width, height) => {
      if (cancelled) {
        return;
      }
      if (width && height) {
        setSize({ width, height });
      } else {
        setMeasure(true);
      }
    }, () => {
      if (!cancelled) {
        // Not supported for embedded images on all platforms
        setMeasure(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (failed) {
    return (
      <Text style={{ opacity: 0.7 }}>{alt ? `${alt} (the image could not be loaded)` : "The image could not be loaded"}</Text>
    );
  }
  if (!size && measure) {
    return (
      <Image
        source={{ uri: src }}
        style={{ width: 1, height: 1, opacity: 0 }}
        onLoad={(e) => {
          const { width, height } = (e.nativeEvent as any)?.source ?? {};
          if (width && height) {
            setSize({ width, height });
          } else {
            setFailed(true);
          }
        }}
        onError={() => setFailed(true)}
      />
    );
  }
  if (!size) {
    return (
      <ActivityIndicator style={{ alignSelf: "flex-start", margin: 12 }} />
    );
  }

  return (
    <Image
      source={{ uri: src }}
      style={{ width: "100%", maxWidth: size.width, aspectRatio: size.width / size.height }}
      resizeMode="contain"
      accessible={!!alt}
      accessibilityLabel={alt}
    />
  );
}

interface RemoteImagePropsType {
  src: string;
  alt?: string;
  style: any;
}

// Images from the internet are only loaded when asked to. Loading them tells the server
// they are on that the note was opened, and notes can come from other people.
function RemoteImage(props: RemoteImagePropsType) {
  const { src, alt, style } = props;
  const [load, setLoad] = React.useState(loadedImages.has(src));

  if (load) {
    return <NoteImage src={src} alt={alt} />;
  }

  const host = /^https?:\/\/([^/?#]+)/i.exec(src)?.[1] ?? src;
  return (
    <TouchableRipple
      style={style}
      accessibilityRole="button"
      accessibilityLabel={`Load image from ${host}`}
      onPress={() => {
        loadedImages.add(src);
        setLoad(true);
      }}
    >
      <View>
        {!!alt && (
          <Text>{alt}</Text>
        )}
        <Text style={{ opacity: 0.7 }}>Tap to load image from {host}</Text>
      </View>
    </TouchableRipple>
  );
}

const getRules = (content: string, setContent: (value: string) => void): RenderRules => {
  return {
    image: (node, _children, _parent, styles) => {
      const { src, alt } = node.attributes;
      // Images that are embedded in the note itself
      if (/^data:image\/(png|gif|jpeg|webp);base64,/i.test(src)) {
        return <NoteImage key={node.key} src={src} alt={alt} />;
      }
      // Anything else is somewhere on the internet, also when it has no scheme
      const url = (/^https?:\/\//i.test(src)) ? src : `https://${src.replace(/^\/+/, "")}`;
      return <RemoteImage key={node.key} src={url} alt={alt} style={styles.remoteImage} />;
    },
    list_item: (node, children, parent, styles, inheritedStyles) => {
      if (node.attributes.class === "task-list-item") {
        return (
          <View
            key={node.key}
            style={styles.tasklistItem}
          >
            <Checkbox
              status={node.attributes.checked === "true" ? "checked" : "unchecked"}
              onPress={() => toggleCheckbox(content, node.attributes.startline, node.attributes.endline, setContent)}
            />
            <View style={styles._VIEW_SAFE_bullet_list_content}>{children}</View>
          </View>
        );
      } else if (renderRules.list_item != null) {
        return renderRules.list_item(node, children, parent, styles, inheritedStyles);
      } else {
        return null;
      }
    },
    textgroup: (node, children, parent, styles, inheritedStyles) => {
      if (renderRules.textgroup != null) {
        const hasTasklistParent = parent.findIndex((p) => p.attributes?.class === "task-list-item") !== -1;
        const style = hasTasklistParent ? { textgroup: styles.tasklistTextgroup } : styles;

        return renderRules.textgroup(node, children, parent, style, inheritedStyles);
      } else {
        return null;
      }
    },
  };
};

const markdownItInstance = MarkdownIt().use(TaskList);

interface MarkdownPropsType extends ViewProps {
  content: string;
  setContent: (value: string) => void;
}

const Markdown = React.memo(function _Markdown(props: MarkdownPropsType) {
  const { content, setContent } = props;
  const theme = useTheme();
  const fontSize = useSelector((state: StoreState) => state.settings.fontSize);
  const fontFamilyKey = useSelector((state: StoreState) => state.settings.viewSettings.viewerFontFamily);

  return (
    <MarkdownDisplay
      markdownit={markdownItInstance}
      rules={getRules(content, setContent)}
      style={getStyles(theme, fontSize, fontFamilyKey)}
      mergeStyle
      onLinkPress={(url) => {
        Linking.openURL(url);
        return true;
      }}
    >
      {content}
    </MarkdownDisplay>
  );
});

export default Markdown;

