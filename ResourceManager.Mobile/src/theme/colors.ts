// Shared color constants
const shared = {
  primary: '#7C3AED',
  accent: '#00C4FF',
  success: '#10B981',
  successBg: '#D1FAE5',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  error: '#EF4444',
  errorBg: '#FEE2E2',
  danger: '#EF4444',
  info: '#3B82F6',
  infoBg: '#DBEAFE',
};

export const lightColors = {
  ...shared,
  primaryLight: '#EDE9FE',
  primaryDark: '#5B21B6',
  background: '#F8F5FF',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',
  border: '#E5E7EB',
  divider: '#F3F4F6',
  white: '#FFFFFF',
  offWhite: '#F9FAFB',
  text: {
    primary: '#111827',
    secondary: '#374151',
    tertiary: '#6B7280',
    light: '#9CA3AF',
    inverse: '#FFFFFF',
  },
  input: {
    background: '#FFFFFF',
    border: '#E5E7EB',
    borderError: '#EF4444',
    borderFocus: '#7C3AED',
    placeholder: '#9CA3AF',
  },
  button: {
    primary: '#7C3AED',
    primaryHover: '#6D28D9',
    secondary: '#FFFFFF',
    secondaryBorder: '#D1D5DB',
    danger: '#EF4444',
    disabled: '#E5E7EB',
  },
  tabBar: {
    background: '#FFFFFF',
    border: '#E5E7EB',
    active: '#7C3AED',
    inactive: '#9CA3AF',
  },
  statusBar: 'dark' as const,
};

export const darkColors = {
  ...shared,
  // In dark mode, primaryLight must be dark-friendly (low opacity purple tint)
  primaryLight: 'rgba(124,58,237,0.22)',
  primaryDark: '#A78BFA',
  // Dark backgrounds — enough contrast between bg ↔ card ↔ elevated
  background: '#0F1219',
  surface: '#181E2A',
  card: '#1E2536',
  cardElevated: '#252D40',
  border: 'rgba(255,255,255,0.14)',
  divider: 'rgba(255,255,255,0.08)',
  white: '#FFFFFF',
  offWhite: '#181E2A',
  text: {
    primary: '#F8FAFC',
    secondary: '#D1D5DB',
    tertiary: '#A1A9B8',
    light: '#7B8494',
    inverse: '#111827',
  },
  input: {
    background: '#1E2536',
    border: 'rgba(255,255,255,0.16)',
    borderError: '#EF4444',
    borderFocus: '#A78BFA',
    placeholder: '#7B8494',
  },
  button: {
    primary: '#7C3AED',
    primaryHover: '#6D28D9',
    secondary: '#1E2536',
    secondaryBorder: 'rgba(255,255,255,0.16)',
    danger: '#EF4444',
    disabled: '#1E293B',
  },
  tabBar: {
    background: '#141821',
    border: 'rgba(255,255,255,0.10)',
    active: '#A78BFA',
    inactive: '#7B8494',
  },
  // Dark mode status colors with alpha tints — slightly bolder for readability
  successBg: 'rgba(16,185,129,0.18)',
  warningBg: 'rgba(245,158,11,0.18)',
  errorBg: 'rgba(239,68,68,0.18)',
  infoBg: 'rgba(59,130,246,0.18)',
  statusBar: 'light' as const,
};

export type AppColors = Omit<typeof lightColors, 'statusBar'> & { statusBar: 'dark' | 'light' };

// Legacy export for backward compatibility — defaults to light
export const colors = lightColors;

export type ColorKey = keyof typeof lightColors;
