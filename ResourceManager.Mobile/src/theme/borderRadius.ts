// Border radius system from Figma design
export const borderRadius = {
  none: 0,
  xs: 4,       // Input fields, small elements
  sm: 6,       // Buttons
  md: 8,       // Cards, standard elements
  lg: 12,      // Large containers
  xl: 16,      // Extra large
  full: 50,     // Status badges (Pill/Circle)
};

export type BorderRadiusValue = typeof borderRadius[keyof typeof borderRadius];
