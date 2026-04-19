import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, type AppColors } from './colors';
import { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing } from './typography';
import { spacing } from './spacing';
import { borderRadius } from './borderRadius';
import { shadows } from './shadows';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppTheme {
  dark: boolean;
  colors: AppColors;
  typography: {
    fontFamily: typeof fontFamily;
    fontSize: typeof fontSize;
    fontWeight: typeof fontWeight;
    lineHeight: typeof lineHeight;
    letterSpacing: typeof letterSpacing;
  };
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
}

interface ThemeModeContext {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<AppTheme | null>(null);
const ThemeModeCtx = createContext<ThemeModeContext>({ themeMode: 'system', setThemeMode: () => {} });

/** Build dark-mode-aware shadows (lighter, purple-tinted for dark) */
function buildShadows(isDark: boolean): typeof shadows {
  if (!isDark) return shadows;
  return {
    ...shadows,
    card: { ...shadows.card, shadowColor: '#000', shadowOpacity: 0.4, elevation: 3 },
    elevated: { ...shadows.elevated, shadowColor: '#7C3AED', shadowOpacity: 0.15, elevation: 5 },
    hover: { ...shadows.hover, shadowColor: '#7C3AED', shadowOpacity: 0.2, elevation: 7 },
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const isDark = themeMode === 'system' ? scheme === 'dark' : themeMode === 'dark';

  const theme = useMemo<AppTheme>(
    () => ({
      dark: isDark,
      colors: isDark ? darkColors : lightColors,
      typography: { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing },
      spacing,
      borderRadius,
      shadows: buildShadows(isDark),
    }),
    [isDark],
  );

  return (
    <ThemeModeCtx.Provider value={{ themeMode, setThemeMode }}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </ThemeModeCtx.Provider>
  );
}

export function useAppTheme(): AppTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider');
  return ctx;
}

export function useThemeMode(): ThemeModeContext {
  return useContext(ThemeModeCtx);
}
