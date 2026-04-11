// Main theme export
import { lightColors } from './colors';
import { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing } from './typography';
import { spacing } from './spacing';
import { borderRadius } from './borderRadius';
import { shadows } from './shadows';

// Legacy static theme for backward-compat (light only).
// Prefer useAppTheme() in new code.
export const theme = {
  colors: lightColors,
  typography: { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing },
  spacing,
  borderRadius,
  shadows,
};

export default theme;

// Re-export individual theme parts
export * from './colors';
export * from './typography';
export * from './spacing';
export * from './borderRadius';
export * from './shadows';
export { ThemeProvider, useAppTheme } from './ThemeContext';
export type { AppTheme } from './ThemeContext';
