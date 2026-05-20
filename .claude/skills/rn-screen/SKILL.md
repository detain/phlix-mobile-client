---
name: rn-screen
description: Scaffolds a new screen in `src/screens/` using `React.FC` default export, `<SafeContainer>`, the project's dark palette (`#0f0f1a`/`#1a1a2e`/`#0066cc`), and `LoadingSpinner`/`ErrorView`/`EmptyState` fallbacks. Updates `src/screens/index.ts` and wires the route into `src/navigation/RootNavigator.tsx` + `src/types/navigation.ts`. Use when user says 'add screen', 'new page', 'add a route', 'create screen', or adds files under `src/screens/`. Do NOT use for non-screen UI (use `rn-component` instead), for the native player modal (already wired), or for stateless presentational widgets.
paths:
  - src/screens/**
  - src/navigation/**
  - src/types/navigation.ts
---
# rn-screen — Scaffold a React Native screen for Phlix Mobile

## Critical

- **Never** create a screen file outside `src/screens/`. The project's screen index, navigator, and types all assume that path.
- **Default export only.** `src/screens/index.ts` uses `export { default as X } from './X'`. A named export will silently fail to wire.
- **Always wrap content in `<SafeContainer>`** from `src/components/layout/SafeContainer.tsx` (with the project's `#0f0f1a` background) unless the screen is a full-bleed modal like `src/screens/PlayerScreen.tsx`.
- **Use a typed function component + arrow function**, no `function` declarations. Every existing screen (`src/screens/HomeScreen.tsx`, `src/screens/LibraryScreen.tsx`, `src/screens/SearchScreen.tsx`, `src/screens/MediaDetailScreen.tsx`, `src/screens/SettingsScreen.tsx`) follows this exactly.
- **Palette is fixed**: background `#0f0f1a`, surface `#1a1a2e`, card `#2d2d44`, primary `#0066cc`, text `#fff`, muted `#888`/`#aaa`. Do not introduce new colors.
- **Three loading/empty fallbacks already exist** — reuse them, do not reinvent:
  - `LoadingSpinner` from `src/components/ui/LoadingSpinner.tsx` (supports `fullScreen` prop)
  - `ErrorView` from `src/components/ui/ErrorView.tsx` (`message`, `onRetry`)
  - `EmptyState` from `src/components/ui/EmptyState.tsx` (`icon`, `title`, `message`)
- **Route params must be typed** in `src/types/navigation.ts`. Untyped `navigation.navigate('Foo')` calls will break the `RootParamList` global declaration.
- After every step, run `npm run typecheck` and confirm zero errors before moving on.

## Instructions

### Step 1 — Decide where the screen lives in the nav tree

Determine which stack the new screen belongs in. Inspect `src/navigation/RootNavigator.tsx`:

| Use case | Stack | ParamList |
|---|---|---|
| Reached from Home tab (e.g. detail, category) | `HomeStackNavigator` | `HomeStackParamList` |
| Reached from Library tab | `LibraryStackNavigator` | `LibraryStackParamList` |
| Top-level tab | `TabNavigator` | `TabParamList` |
| Full-screen modal (like Player) | root `Stack` | `RootStackParamList` |

If the screen needs to be reachable from multiple tabs, prefer adding it to each tab stack rather than promoting it to the root stack (see how `MediaDetail` is registered in both `HomeStack` and `LibraryStack`).

**Verify**: you can name the exact `ParamList` and `Navigator` you will edit. Do not proceed until you can.

### Step 2 — Add the route to `src/types/navigation.ts`

Add the route key to the chosen `ParamList`. Use `undefined` if it takes no params, otherwise an inline object type. Match existing style:

```ts
export type HomeStackParamList = {
  HomeMain: undefined;
  MediaDetail: { itemId: string };
  SeasonDetail: { seasonId: string };
  // ADD HERE — example:
  Genre: { genreId: string; title: string };
};
```

Do not export a new screen-props alias unless the screen actually reads `route.params` via typed props (most screens use `useRoute<RouteProp<..., '...'>>()` instead — see `src/screens/MediaDetailScreen.tsx` near line 32).

**Verify**: `npm run typecheck` passes.

### Step 3 — Create the screen file

File path: `src/screens/{Name}Screen.tsx` (PascalCase, must end in `Screen`).

Use this exact skeleton, matching `src/screens/SearchScreen.tsx` and `src/screens/MediaDetailScreen.tsx` conventions:

```tsx
// src/screens/GenreScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeContainer } from '../components/layout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ErrorView } from '../components/ui/ErrorView';
import { EmptyState } from '../components/ui/EmptyState';
// import the manager you need, e.g.:
// import { libraryManager } from '../api/LibraryManager';

type GenreRouteParams = {
  Genre: { genreId: string; title: string };
};

type GenreNavigationProp = NativeStackNavigationProp<any>;

const GenreScreen: React.FC = () => {
  const navigation = useNavigation<GenreNavigationProp>();
  const route = useRoute<RouteProp<GenreRouteParams, 'Genre'>>();
  // const { genreId } = route.params;

  const [data, setData] = useState<SomeType[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // const result = await libraryManager.something();
      // setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (error) return <ErrorView message={error} onRetry={loadData} />;
  if (!data || data.length === 0) {
    return (
      <SafeContainer>
        <EmptyState icon="📭" title="Nothing here" message="No items to show." />
      </SafeContainer>
    );
  }

  return (
    <SafeContainer>
      <View style={styles.container}>
        <Text style={styles.title}>Screen Title</Text>
        {/* content */}
      </View>
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
});

export default GenreScreen;
```

Rules for the body:
- Background color must remain `#0f0f1a` (provided by the SafeContainer's default).
- Headings/body text use `color: '#fff'` for primary, `'#aaa'` or `'#888'` for muted.
- Action buttons use `backgroundColor: '#0066cc'` (primary) or `'#2d2d44'` (secondary).
- Card surfaces use `backgroundColor: '#2d2d44'`, border-radius `8`.
- Drop `useRoute` and the route params type entirely if the route has no params (see `src/screens/SearchScreen.tsx`).
- Drop `useNavigation` if the screen does not navigate anywhere (rare).

**Verify**: `npm run typecheck` passes and `npm run lint` reports no errors on the new file.

### Step 4 — Re-export from `src/screens/index.ts`

Append one line, alphabetical with existing entries is not required (see current order in the file):

```ts
export { default as GenreScreen } from './GenreScreen';
```

**Verify**: `npm run typecheck` still passes.

### Step 5 — Register the route in `src/navigation/RootNavigator.tsx`

1. Add the import to the existing `from '../screens'` block:
   ```ts
   import {
     HomeScreen,
     // …
     GenreScreen,
   } from '../screens';
   ```
2. Add a `<...Stack.Screen>` entry inside the navigator you chose in Step 1. Mirror the existing pattern (no headers by default for content screens):
   ```tsx
   <HomeStack.Screen
     name="Genre"
     component={GenreScreen}
     options={{ headerShown: false }}
   />
   ```
   For a tab, add to `TabNavigator` with `options={{ headerShown: false }}`. For a modal, add to root `Stack` with `options={{ presentation: 'fullScreenModal', animation: 'fade' }}` like `Player`.

**Verify**: `npm run typecheck` passes. Start Metro (`npm start`) and run the app (`npm run ios` or `npm run android`) and navigate to the route to confirm it mounts.

### Step 6 — Wire navigation from the caller

Find the screen that will push to the new route and call:

```ts
navigation.navigate('Genre', { genreId: 'g1', title: 'Action' });
```

With the param list updated in Step 2, TypeScript will autocomplete and check this call.

**Verify**: `npm run typecheck` && `npm run lint` && `npm test` all pass.

## Examples

### Example 1 — "Add a Genre browse screen reachable from Home"

**User says**: "Add a screen that lists everything in a genre when you tap a genre tag."

**Actions**:
1. Pick `HomeStackNavigator` / `HomeStackParamList` (genre tags live on Home).
2. In `src/types/navigation.ts`, add to `HomeStackParamList`: `Genre: { genreId: string; title: string };`.
3. Create `src/screens/GenreScreen.tsx` using the Step 3 skeleton; in `loadData` call `libraryManager.getItemsByGenre(genreId)`; render with a `FlatList` of `MediaCard`.
4. Add `export { default as GenreScreen } from './GenreScreen';` to `src/screens/index.ts`.
5. In `src/navigation/RootNavigator.tsx`, import `GenreScreen`, then inside `HomeStackNavigator` add `<HomeStack.Screen name="Genre" component={GenreScreen} options={{ headerShown: false }} />`.
6. Update the genre tap handler in `src/screens/MediaDetailScreen.tsx` (or wherever genres are rendered) to call `navigation.navigate('Genre', { genreId: genre.id, title: genre.name })`.

**Result**: Tapping a genre on Home pushes `GenreScreen`; back arrow returns to detail; TS knows the params.

### Example 2 — "Add a top-level Profiles tab"

**User says**: "Add a Profiles tab."

**Actions**:
1. Pick `TabNavigator` / `TabParamList`.
2. In `src/types/navigation.ts`, add `Profiles: undefined;` to `TabParamList` (note: a `Profiles` route already exists on `RootStackParamList` — remove it if migrating, otherwise rename the new tab).
3. Create `src/screens/ProfilesScreen.tsx` from skeleton with no `useRoute` block.
4. Append to `src/screens/index.ts`.
5. In `src/navigation/RootNavigator.tsx`, import `ProfilesScreen`, add `<Tab.Screen name="Profiles" component={ProfilesScreen} options={{ headerShown: false }} />`, and add a `Profiles: '👤'` entry to the `TabIcon` `icons` map.

**Result**: New tab appears with the project's tab-bar styling (`#1a1a2e` background, `#0066cc` active tint).

## Common Issues

- **TS2305 `Module '"../screens"' has no exported member 'GenreScreen'`**: You added the `.tsx` file but forgot Step 4 — add the line to `src/screens/index.ts`.
- **TS2322 on `<Stack.Screen name="Genre">` saying `Type '"Genre"' is not assignable to type 'keyof ...ParamList'`**: Step 2 was skipped — add the route key to the correct `ParamList` in `src/types/navigation.ts`.
- **`Error: Couldn't find a navigation object`**: The screen was rendered outside `NavigationContainer`. Make sure it is registered in `src/navigation/RootNavigator.tsx` (Step 5) and reached via `navigation.navigate`, not rendered directly.
- **`SafeAreaProvider` warning / status bar overlapping content**: You wrapped content in a plain `<View>` instead of `<SafeContainer>`. Replace it; SafeContainer handles top inset + `StatusBar barStyle="light-content"`.
- **Screen renders white / wrong color**: You set a `backgroundColor` other than `#0f0f1a`, or omitted SafeContainer. Use SafeContainer with its default background.
- **`useRoute` returns `undefined` params**: The route was registered without params in the `ParamList` (Step 2). Add the params type, restart Metro with `npm start -- --reset-cache`.
- **Jest fails with `Cannot find module 'react-native-safe-area-context'`**: `jest.setup.js` already mocks this — confirm the new test file uses `preset: 'react-native'` (already set in `jest.config.js`) and does not import the real module directly.
- **ESLint complains about unused `route` / `navigation`**: Delete the unused hook call — do not leave dead imports just because the skeleton included them.
