// Typography system from Figma design
export const fontFamily = {
  // Inter font family (most similar to Figma design)
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const fontSize = {
  // Heading sizes
  h1: 24,       // Page Title
  h2: 20,       // Section Title
  h3: 16,       // Card Title
  h4: 14,       // Subheading

  // Body sizes
  body: 14,      // Body Text
  small: 12,      // Small Text/Status Badges
  xs: 10,        // Extra Small
  caption: 11,   // Captions
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
};

export const letterSpacing = {
  tight: -0.5,
  normal: 0,
  relaxed: 0.5,
};
