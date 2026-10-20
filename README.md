<p align="center">
  <img width="120" src="assets/icon.png" />
  <h1 align="center">EteSync Notes</h1>
</p>

> [!NOTE]
> **This is an independent fork** of [EteSync Notes](https://github.com/etesync/etesync-notes), the original
> project of the EteSync authors. This fork is not affiliated with, endorsed by or supported by EteSync or
> [etesync.com](https://www.etesync.com) in any way. The history of the original project is kept as it is,
> with its authors, and the changes of this fork follow it. Like the original, it's licensed under the
> [GPL-3.0](LICENSES/GPL-3.0-only).

Secure, end-to-end encrypted, and privacy-respecting notes and bookmarks for Android, synced with an
[Etebase](https://www.etebase.com) server (your own, or EteSync's).

- Notes in Markdown, in notebooks, which can be searched, exported to a zip and imported from one
- Bookmarks, saved from the share menu of other apps
- Works offline, and syncs while the app is open

## Download

The APKs are on the [releases page](https://github.com/nikossvnk/etesync-notes/releases):
`etesync-notes-X.Y.Z.apk` for 64-bit phones (nearly all of them), and
`etesync-notes-X.Y.Z-armeabi-v7a.apk` for older 32-bit phones. Each has a `.sha256` next to it.

## Building

It's an [Expo](https://expo.dev) (React Native) app. With Node.js 24, JDK 17 and the Android SDK
(`ANDROID_HOME` set):

```
npm install
npx tsc --noEmit && npm run lint    # the checks CI runs
npm run android                     # build, install and start it on a device or emulator
```

A release APK: `cd android && ./gradlew assembleRelease`. It's signed with the debug key unless the
release key is given (see `android/app/build.gradle`), and such builds are for testing only. Releases
are built by the release workflow when a `vX.Y.Z` tag is pushed.

The app also builds for the web (`npx expo export --platform web`), which is only used by the
browser tests in [`e2e`](e2e/README.md).
