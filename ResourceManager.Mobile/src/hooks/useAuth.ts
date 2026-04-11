// This file intentionally re-exports from useAuth.tsx
// Metro bundler resolves .ts before .tsx, so this bridges the two.
export { AuthProvider, useAuth } from './useAuth.tsx';
export type { User } from './useAuth.tsx';
