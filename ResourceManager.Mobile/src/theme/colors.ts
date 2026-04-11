// Shared color constants
const shared = {
  primary: '#7C3AED',
  primaryLight: '#EDE9FE',
  primaryDark: '#5B21B6',
  accent: '#00C4FF',
  success: '#10B981',
  successBg: '#D1FAE5',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  error: '#EF4444',
  errorBg: '#FEE2E2',
  info: '#3B82F6',
  infoBg: '#DBEAFE',
};

export const lightColors = {
  ...shared,
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
  background: '#0A0E1A',
  surface: '#0F1629',
  card: '#141D30',
  cardElevated: '#1A2540',
  border: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.05)',
  white: '#FFFFFF',
  offWhite: '#0F1629',
  text: {
    primary: '#FFFFFF',
    secondary: '#CBD5E1',
    tertiary: '#94A3B8',
    light: '#64748B',
    inverse: '#111827',
  },
  input: {
    background: '#141D30',
    border: 'rgba(255,255,255,0.12)',
    borderError: '#EF4444',
    borderFocus: '#7C3AED',
    placeholder: '#64748B',
  },
  button: {
    primary: '#7C3AED',
    primaryHover: '#6D28D9',
    secondary: '#141D30',
    secondaryBorder: 'rgba(255,255,255,0.12)',
    danger: '#EF4444',
    disabled: '#1E293B',
  },
  tabBar: {
    background: '#0F1629',
    border: 'rgba(255,255,255,0.08)',
    active: '#7C3AED',
    inactive: '#64748B',
  },
  statusBar: 'light' as const,
};

export type AppColors = Omit<typeof lightColors, 'statusBar'> & { statusBar: 'dark' | 'light' };

// Legacy export for backward compatibility — defaults to light
export const colors = lightColors;

export type ColorKey = keyof typeof lightColors;
