// This file intentionally re-exports from useAuth.tsx
// Metro bundler resolves .ts before .tsx, so this bridges the two.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- cross-extension re-export
export { AuthProvider, useAuth } from './useAuth.tsx';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- cross-extension re-export
export type { User } from './useAuth.tsx';
