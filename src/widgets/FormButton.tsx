import * as React from "react";
import { Button } from "react-native-paper";

type PropsType = Omit<React.ComponentProps<typeof Button>, "mode">;

export default function FormButton(props: PropsType) {
  const { children, style, ...rest } = props;
  return (
    <Button
      mode="contained"
      style={style}
      {...rest}
    >
      {children}
    </Button>
  );
}