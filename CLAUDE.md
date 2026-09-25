@AGENTS.md

# Me Simplified

A personal "life, simplified" app. The first feature is a train tracker: a commute screen whose sky scene and palette follow the time of day (dawn, midday, dusk, night), showing when to leave for the next train from Sunnyvale to Britomart.

## Stack

- Expo SDK 57 (React Native 0.86, React 19.2, React Compiler on), TypeScript strict
- Expo Router with typed routes. Tabs are headless `expo-router/ui` tabs with a custom tab bar (`src/components/app-tabs.tsx`)
- react-native-reanimated 4, react-native-svg, expo-haptics
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
    ui/                screens and components for the feature
  components/          UI shared across features (tab bar, placeholder screen)
  constants/theme.ts   time-of-day palettes (PhaseThemes), font families
  hooks/               shared hooks (useNow, usePhase)
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

- `.env` (gitignored, copy from `.env.example`) holds `EXPO_PUBLIC_DATA_SOURCE=mock|live`, read only in `src/features/train-tracker/api/data-source.ts`.
- `EXPO_PUBLIC_` values are inlined into the JS bundle and readable by anyone with the app. Never put secrets in them.
- Reference env vars as `process.env.EXPO_PUBLIC_X` (static dot access). Destructuring or `process.env[name]` is not inlined.

## Rule: the Auckland Transport API key

The AT API key is provided by the user in the app and stored **only** in `expo-secure-store`.

- Never put it in env vars (`EXPO_PUBLIC_*` or otherwise), `app.json`, source code, or any other storage (AsyncStorage, MMKV, files, React Query cache).
- Never put it in a URL or query string. Send it only as the `Ocp-Apim-Subscription-Key` request header.
- Never log it or include it in errors, analytics, crash reports, or saved fixtures. Don't log request headers.
- Read it from secure store when making a request instead of caching it elsewhere. The only exception is the key-entry form, which holds it in state until it's saved.

`scripts/at-spike` is a local dev tool, not part of the app. It reads the developer's own key from its gitignored `scripts/at-spike/.env`, which is outside the app bundle. That key must still never be logged, committed, or copied into app code.
