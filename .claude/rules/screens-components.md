---
paths:
  - src/screens/**
  - src/components/**
---

# Screen & Component Conventions

- Components are `React.FC<Props>` arrow functions with a colocated `StyleSheet.create({...})` at the bottom of the file.
- Screens use `default export`; reusable components use `named export` and re-export through a sibling `index.ts` (see `src/components/ui/index.ts`).
- Wrap screens in `<SafeContainer edges={['top']}>` from `src/components/layout/`. Background defaults to `#0f0f1a`.
- Dark palette (match `android/app/src/main/res/values/colors.xml`): bg `#0f0f1a`, surface `#1a1a2e`, card `#2d2d44`, accent `#0066cc`, text `#fff`, muted `#888`.
- Loading/error/empty: use `<LoadingSpinner fullScreen />`, `<ErrorView message=... onRetry=... />`, `<EmptyState icon=... title=... message=... />` from `src/components/ui/`.
- Navigation: `useNavigation<NativeStackNavigationProp<any>>()` for cross-stack jumps; typed `RouteProp<>` for params. Param shapes live in `src/types/navigation.ts`.
- Lists: `FlatList` with `keyExtractor={(item) => item.id}`, horizontal lists use `showsHorizontalScrollIndicator={false}` and `contentContainerStyle`.
- Images: always provide a placeholder fallback `'https://via.placeholder.com/...'` (`MediaCard.tsx` pattern).
- Convert ticks to seconds with `/ 10000000` when handing to the player (`MediaDetailScreen.tsx`).
