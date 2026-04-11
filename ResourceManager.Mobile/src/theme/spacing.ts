// Spacing system (4px base unit)
export const spacing = {
  xs: 4,        // 0.25rem
  sm: 8,        // 0.5rem
  md: 16,       // 1rem
  lg: 24,       // 1.5rem
  xl: 32,       // 2rem
  xxl: 48,      // 3rem
  xxxl: 64,     // 4rem
};

export type SpacingValue = typeof spacing[keyof typeof spacing];
