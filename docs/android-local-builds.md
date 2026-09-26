# Local Android preview builds

Build the `preview` APK on your Mac instead of waiting in the EAS cloud queue,
then install it on your phone over USB.

A local build uses the same `preview` profile from `eas.json` as a cloud build:

- live AT data (`EXPO_PUBLIC_DATA_SOURCE=live`)
- the `preview` update channel, so `eas update --channel preview` reaches it
- the same signing key (from EAS), so it installs over a cloud-built preview
  APK and keeps your settings and saved API key

APKs go in `builds/`, which is gitignored. EAS also skips gitignored files when
it uploads the project for cloud builds, so APKs never get uploaded.

## Quick reference

```bash
pnpm apk:build     # build builds/handy-me-preview.apk (about 5 minutes)
adb devices        # phone should be listed as "device"
pnpm apk:install   # install it, keeping app data
```

For JavaScript-only changes, skip the build and send an update:

```bash
pnpm dlx eas-cli@latest update --channel preview --message "what changed"
```

Fully close and reopen the app (sometimes twice) to load the update.

## One-time setup

### On the Mac

You need JDK 17, the Android SDK with an NDK (Android Studio installs these),
and `adb`. Check:

```bash
java -version        # 17.x
echo $ANDROID_HOME   # e.g. /Users/<you>/Library/Android/sdk
adb version
```

Log in to EAS. The build downloads the signing key from EAS:

```bash
pnpm dlx eas-cli@latest whoami   # or: pnpm dlx eas-cli@latest login
```

If an earlier `sudo npm` left root-owned files in the npm cache, the build
fails with `npm error EACCES`. Fix it once:

```bash
sudo chown -R $(id -u):$(id -g) ~/.npm
```

### On the phone

1. **Settings → About phone** → tap **Build number** 7 times to turn on
   Developer options.
2. **Settings → System → Developer options** → turn on **USB debugging**.
3. Connect the phone by USB, accept **Allow USB debugging?** on the phone, and
   tick **Always allow from this computer**.

`adb devices` should now list the phone as `device`. If it says `unauthorized`,
unlock the phone and accept the prompt.

## Building

```bash
pnpm apk:build
```

This runs:

```bash
pnpm dlx eas-cli@latest build -p android --profile preview --local \
  --output ./builds/handy-me-preview.apk
```

The build copies the project into a temporary folder and runs the same steps
as the cloud: install dependencies, `expo doctor`, prebuild, bundle the
JavaScript, then Gradle. It ends with `BUILD SUCCESSFUL` and
`You can find the build artifacts in …/builds/handy-me-preview.apk`.

Each build overwrites `builds/handy-me-preview.apk`. To keep an older one,
rename it first.

When a build includes uncommitted changes, the log says "Git working tree
dirty". That's fine: the build uses your working copy.

## Installing

```bash
pnpm apk:install   # adb install -r ./builds/handy-me-preview.apk
```

`-r` replaces the installed app and keeps its data. Without a cable, you can
also copy the APK to the phone and open it there. Android asks you to allow
installs from that app the first time.

## When to rebuild and when to update

The app's `runtimeVersion` follows `version` in `app.json`, so an update only
reaches builds with the same `version`.

| Change                                                         | What to do                     |
| -------------------------------------------------------------- | ------------------------------ |
| JS/TS code, styles, images                                     | `eas update --channel preview` |
| New native package, `app.json` / plugin change, `eas.json` env | `pnpm apk:build` and reinstall |
| `version` in `app.json` bumped                                 | `pnpm apk:build` and reinstall |

`eas update` bundles the JavaScript on your Mac and reads your local `.env`, not
`eas.json`. Check that `.env` has `EXPO_PUBLIC_DATA_SOURCE=live` before
publishing to `preview`.

## Troubleshooting

**`Timeout waiting to lock journal cache … in use by another process`**
A Gradle daemon from an earlier or cancelled build is still running. Stop it
and build again:

```bash
pkill -f GradleDaemon
```

**`OutOfMemoryError: Metaspace`**
Gradle ran out of memory. `plugins/with-gradle-jvm-args.js` sets
`org.gradle.jvmargs` to 4 GB heap and 1 GB Metaspace. Raise those numbers if it
happens again.

**`npm error EACCES` … `~/.npm`**
The root-owned npm cache described under one-time setup.

**`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`**
The lockfile has a package version less than 24 hours old.
`pnpm-workspace.yaml` sets `minimumReleaseAge: 1440` so local installs don't
pick those. If it still happens, wait a day or re-resolve that package.

**`ERR_PNPM_IGNORED_BUILDS`**
A new dependency has a build script that is neither allowed nor denied. Add it
under `allowBuilds` in `pnpm-workspace.yaml`: `false` unless the package needs
its script to work.

**`adb: no devices/emulators found`**
Reconnect the cable, unlock the phone, and check `adb devices`.

**`INSTALL_FAILED_UPDATE_INCOMPATIBLE`**
The installed app is signed with a different key, for example one built with
`expo run:android`. Uninstall it first. This deletes the app's data, including
the saved API key:

```bash
adb uninstall com.simarexpo.handyme
```
