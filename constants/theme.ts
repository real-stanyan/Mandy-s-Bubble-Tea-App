/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#8D5524';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const T = {
  bg:        '#F2E8DF',
  bg2:       '#E8DAC6',
  paper:     '#FFF9F0',
  card:      '#FFFFFF',
  ink:       '#2A1E14',
  ink2:      '#5A4330',
  ink3:      'rgba(42,30,20,0.55)',
  ink4:      'rgba(42,30,20,0.28)',
  line:      'rgba(42,30,20,0.10)',
  brand:     '#8D5524',
  brandDark: '#6B3E15',
  sage:      '#A2AD91',
  peach:     '#FFB380',
  cream:     '#FFF3DE',
  star:      '#F2B64A',
  green:     '#3CA96E',
  greenDark: '#2E7F52',
} as const;

export const FONT = {
  serif: 'Fraunces',
  sans: 'Inter',
  mono: 'JetBrainsMono',
} as const;

export const RADIUS = {
  pill: 999,
  card: 20,
  tile: 12,
  small: 10,
  sheetTop: 24,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const SHADOW = {
  card: {
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  miniCart: {
    shadowColor: '#6B3E15',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryCta: {
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 10,
  },
  successBubble: {
    shadowColor: '#3C644C',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 30,
    elevation: 12,
  },
} as const;

export const TYPE = {
  screenTitleSm:  { fontFamily: 'Fraunces_500Medium', fontSize: 22, letterSpacing: -0.5 },
  screenTitleLg:  { fontFamily: 'Fraunces_500Medium', fontSize: 28, letterSpacing: -0.5 },
  cardTitle:      { fontFamily: 'Fraunces_500Medium', fontSize: 17, letterSpacing: -0.3 },
  productName:    { fontFamily: 'Fraunces_500Medium', fontSize: 26 },
  productNameSm:  { fontFamily: 'Fraunces_500Medium', fontSize: 24 },
  body:           { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  bodyStrong:     { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19 },
  label:          { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, lineHeight: 18 },
  priceLg:        { fontFamily: 'JetBrainsMono_700Bold', fontSize: 22 },
  priceMd:        { fontFamily: 'JetBrainsMono_700Bold', fontSize: 18 },
  priceSm:        { fontFamily: 'JetBrainsMono_700Bold', fontSize: 13 },
  eyebrow:        { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10.5, letterSpacing: 1.3, textTransform: 'uppercase' as const },
} as const;

export type ThemeColor = keyof typeof T;
export type TypePreset = keyof typeof TYPE;
