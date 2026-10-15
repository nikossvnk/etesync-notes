// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/es/integration/react";
import App from "./App";
import ShareApp from "./ShareApp";
import { Shared } from "./screens/BookmarkShareScreen";

import "react-native-etebase";
import * as Etebase from "etebase";
import { store, persistor } from "./store";

function MyPersistGate(props: React.PropsWithChildren<unknown>) {
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Etebase.ready.then(() => {
      setLoading(false);
      persistor.persist();
    });
  }, []);

  if (loading) {
    return (<React.Fragment />);
  }

  return (
    <PersistGate persistor={persistor}>
      {props.children}
    </PersistGate>
  );
}

// The app, or (on Android) only the sheet to save a link that was shared with it: ShareActivity
// starts it with what was shared
class Index extends React.Component<{ share?: Shared }> {
  public render() {
    return (
      <Provider store={store}>
        <MyPersistGate>
          {(this.props.share) ? <ShareApp share={this.props.share} /> : <App />}
        </MyPersistGate>
      </Provider>
    );
  }
}

export default Index;
