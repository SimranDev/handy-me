@AGENTS.md

# Handy Me

A personal app of handy everyday tools. The first feature is a train tracker: a commute screen whose sky scene and palette follow the time of day (dawn, midday, dusk, night), showing when to leave for the next train from the user's station. Each commute profile (e.g. "To work", "Gym") has its own station, platform, walk time and destination label. Profiles are created and edited in Settings and switched from the commute screen. Nothing about the commute is hard-coded.

## Stack

- Expo SDK 57 (React Native 0.86, React 19.2, React Compiler on), TypeScript strict
- Expo Router with typed routes. Tabs are headless `expo-router/ui` tabs with a custom tab bar (`src/components/app-tabs.tsx`)
- react-native-reanimated 4, react-native-svg, expo-haptics
- Zustand for client state, persisted with react-native-mmkv (a Nitro module, so it needs a development build)
- Fonts: DM Sans and Fraunces via `@expo-google-fonts`, loaded in `src/app/_layout.tsx`
- Development build (`expo-dev-client`), not Expo Go
- ESLint (`eslint-config-expo`) with Prettier defaults: double quotes, 80 columns

## Folders

```
src/
  app/                 routes only; keep each file a thin wrapper around a feature screen
  features/<feature>/
    api/               talking to outside services (AT API client, data-source switch)
    domain/            pure logic and types, no React or I/O (easy to unit-test)
    mock/              fake data used when EXPO_PUBLIC_DATA_SOURCE=mock
    store/             persisted client state (Zustand stores saved to MMKV)
    ui/                screens and components for the feature
  domain/              shared pure logic: Auckland time, sky model (suncalc sun/moon, day progress)
  components/          UI shared across features (tab bar, placeholder screen, query provider)
  constants/theme.ts   time-of-day palettes (PhaseThemes), blendTheme, font families
  hooks/               shared hooks (useNow, useSky, useAppActive)
jest/                  Jest setup (Reanimated test utils) and stubs
scripts/at-spike/      standalone Node script for exploring the AT API (its own package)
```

## pnpm

This repo uses pnpm (`pnpm-lock.yaml`). Wherever AGENTS.md says `npx`/`bunx`, use pnpm:

```bash
pnpm install
pnpm expo install <package>   # always use this to add packages: picks SDK-compatible versions
pnpm expo start               # dev server
pnpm lint                     # expo lint
pnpm exec tsc --noEmit        # typecheck
pnpm test                     # jest (jest-expo); add -- --watch while developing
pnpm dlx expo-doctor          # diagnose dependency and config issues
pnpm dlx eas-cli@latest <cmd> # EAS build, submit, update
```

Run lint, typecheck and tests before calling a task done. Unit tests live in `__tests__/` next to the code (mainly `domain/`), with fixtures built from the real responses in `scripts/at-spike/samples/`. `scripts/at-spike` has its own `package.json` and lockfile: run `pnpm install` inside it. The root `tsconfig.json` and ESLint config exclude it.

## Environment

- Non-secret settings (the commute profiles: station stop_code, station name, walk time, destination label; and which profile is active) live in `src/features/settings/store/settings-store.ts`, a Zustand store saved to MMKV. On the first launch with MMKV it imports, then removes, settings saved earlier with AsyncStorage. Store a platform's `stop_code`, never its `stop_id`: stop_id changes with each GTFS version.
- `.env` (gitignored, copy from `.env.example`) holds `EXPO_PUBLIC_DATA_SOURCE=mock|live`, read only in `src/features/train-tracker/api/data-source.ts`, and optionally `AT_API_KEY` for the dev proxy (see the key rule below). Restart the dev server after changing it.
- `EXPO_PUBLIC_` values are inlined into the JS bundle and readable by anyone with the app. Never put secrets in them.
- Reference env vars as `process.env.EXPO_PUBLIC_X` (static dot access). Destructuring or `process.env[name]` is not inlined.

## Rule: the Auckland Transport API key

The AT API key is provided by the user in the app and stored **only** in `expo-secure-store`.

- Never put it in `EXPO_PUBLIC_*` env vars, `app.json`, source code, or any other storage (AsyncStorage, MMKV, files, React Query cache). The one env var allowed is the dev proxy's `AT_API_KEY` (below).
- Never put it in a URL or query string. Send it only as the `Ocp-Apim-Subscription-Key` request header.
- Never log it or include it in errors, analytics, crash reports, or saved fixtures. Don't log request headers.
- Read it from secure store when making a request instead of caching it elsewhere. The only exception is the key-entry form, which holds it in state until it's saved.

**Dev proxy exception.** For development and web (secure store doesn't work in browsers), the developer can put their own key in `.env` as `AT_API_KEY`, with no `EXPO_PUBLIC_` prefix so it is never inlined into the bundle. Only `scripts/at-dev-proxy.js` reads it, inside the Metro dev server (wired up in `metro.config.js`): it forwards `/at-proxy/gtfs/…` and `/at-proxy/realtime/…` GETs to `api.at.govt.nz` and adds the header. The app (`src/features/train-tracker/api/dev-proxy.ts`) uses the proxy only when `__DEV__` is true and no key is saved in secure store. It learns only whether the proxy has a key, never the key itself. Production builds have no dev server, so no proxy. Keep it that way: never return, log or expose the key from the proxy, never widen what it forwards beyond AT's GTFS and realtime paths, and never read `AT_API_KEY` from app code. The proxy is reachable by anything that can reach Metro on your network.

`scripts/at-spike` is a local dev tool, not part of the app. It reads the developer's own key from its gitignored `scripts/at-spike/.env`, which is outside the app bundle. That key must still never be logged, committed, or copied into app code.
