import * as React from "react";
import { GestureResponderEvent } from "react-native";
import { NavigationAction, useLinkBuilder, useLinkProps } from "@react-navigation/native";
import Clickable from "./Clickable";

type ChildProps = {
  onPress?: () => void;
};

type PropsType = {
  to?: string;
  action?: NavigationAction;
  external?: boolean;
  onPress?: () => void;
  renderChild: (props: ChildProps) => React.ReactElement;
};

export default function Link(props: PropsType) {
  const { to, action, external, onPress: onPressProp, renderChild } = props;
  const { buildAction } = useLinkBuilder();
  const internal = !!to && !external;
  const linkProps = useLinkProps({
    href: (internal) ? to : undefined,
    action: action ?? ((internal) ? buildAction(to!) : { type: "NOOP" }),
  });

  const onPress = (
    e?: React.MouseEvent<HTMLAnchorElement, MouseEvent> | GestureResponderEvent
  ) => {
    onPressProp?.();

    if (!external) {
      linkProps.onPress(e);
    }
  };

  return (
    <Clickable
      applyToChild
      renderChild={(props) => (
        <a
          {...props}
          onClick={onPress}
          href={(external) ? to : linkProps.href}
          target={(external) ? "_blank" : undefined}
          style={{ textDecoration: "none" }}
        >
          {renderChild({})}
        </a>
      )}
    />
  );
}