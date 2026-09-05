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

const DAY = {
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

// Evening Mode — the web's "midnight cafe" palette (#177), same hexes on the
// same token names: near-neutral espresso ground, a whisper of warmth in the
// cards, gold accent, parchment text. peach/cream/star/sage carry over
// unchanged, exactly as on web.
const EVENING = {
  ...DAY,
  bg:        '#131110',
  bg2:       '#221C16',
  paper:     '#1A1512',
  card:      '#262019',
  ink:       '#F5EDE1',
  ink2:      '#D8C8B4',
  ink3:      'rgba(245,237,225,0.62)',
  ink4:      'rgba(245,237,225,0.34)',
  line:      'rgba(245,237,225,0.14)',
  brand:     '#D9A24E',
  brandDark: '#B5813A',
  green:     '#4CC084',
  greenDark: '#3CA96E',
} as const;

// Decided ONCE, at module load — before any component's StyleSheet.create
// runs, which is what lets every static style pick up the evening values
// with zero component changes. The cost is that crossing 18:00 mid-session
// doesn't restyle until the next cold start; the web pays the same price
// per page-load and nobody noticed. Same window as web: 18:00–06:00 device
// time.
const hour = new Date().getHours();
export const IS_EVENING = hour >= 18 || hour < 6;

export const T = (IS_EVENING ? EVENING : DAY) as typeof DAY;

/** Theme-INVARIANT colors for poster faces and deliberately-dark chips.
 *
 *  Evening keeps light surfaces light (pastel tiles, cream/peach promo
 *  gradients) and has no cream override — but T.ink flips light, so any
 *  "T.ink on a light surface" or "dark T.ink chip with T.cream text"
 *  pairing inverts into light-on-light after 18:00 (Stan's Account-page
 *  screenshots, 2026-08-10). Web solved this in #177 by pinning exactly
 *  these cases to day colors; PIN is the app's version of that rule.
 *  Use PIN.* on any surface whose background does not change with the
 *  theme; use T.* everywhere the background is a theme token. */
export const PIN = {
  ink: '#2A1E14',
  ink2: '#5A4330',
  ink3: 'rgba(42,30,20,0.55)',
  /** Deliberately-dark chip/pill background (Expand, Reorder, Use…). */
  chip: '#2A1E14',
  /** Cream text/icon on that chip. */
  onChip: '#FFF3DE',
} as const;

/**
 * The one filled call-to-action: Place order, Checkout, Continue with phone.
 *
 * PIN.chip was used for these, which is right by day — #2A1E14 on the cream
 * page reads 13.4:1 — and invisible after sunset, where the same ink sits on
 * a #131110 page at 1.16:1. Stan's screenshot of the pay bar is that number:
 * the button had not lost its label, it had lost its edges.
 *
 * Brand carries the contrast in both: 5.03:1 on the day page, 8.27:1 on the
 * night one. `on` flips because evening brand is a light gold and white on it
 * measures 2.3:1 — the pairing this codebase keeps re-learning.
 *
 * One token so the next call site cannot get it wrong on its own.
 */
export const CTA = {
  bg: (IS_EVENING ? EVENING : DAY).brand,
  on: IS_EVENING ? '#2A1E14' : '#FFFFFF',
} as const;

export const FONT = {
  serif: 'ShantellSans_700Bold',
  sans: 'ShantellSans_400Regular',
  mono: 'JetBrainsMono',
} as const;

// One radius per level, and a nested corner is the outer one minus the
// padding: card 24 → tile 16 → chip 12; pills are pills.
export const RADIUS = {
  pill: 999,
  card: 24,
  tile: 16,
  small: 12,
  sheetTop: 28,
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
  // Ambient: the card rests on the page rather than floats over it. Ink-
  // tinted, never black; the hairline border does the separating, this does
  // the lifting. Sheets and the primary CTA keep their own, heavier shadows.
  card: {
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
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
  readyCard: {
    shadowColor: '#3C644C',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 26,
    elevation: 10,
  },
} as const;

export const TYPE = {
  screenTitleSm:  { fontFamily: 'ShantellSans_700Bold', fontSize: 22, letterSpacing: -0.5 },
  screenTitleLg:  { fontFamily: 'ShantellSans_700Bold', fontSize: 28, letterSpacing: -0.5 },
  cardTitle:      { fontFamily: 'ShantellSans_700Bold', fontSize: 17, letterSpacing: -0.3 },
  productName:    { fontFamily: 'ShantellSans_700Bold', fontSize: 26 },
  productNameSm:  { fontFamily: 'ShantellSans_700Bold', fontSize: 24 },
  body:           { fontFamily: 'ShantellSans_400Regular', fontSize: 13, lineHeight: 19 },
  bodyStrong:     { fontFamily: 'ShantellSans_500Medium', fontSize: 13, lineHeight: 19 },
  label:          { fontFamily: 'ShantellSans_600SemiBold', fontSize: 12.5, lineHeight: 18 },
  priceLg:        { fontFamily: 'JetBrainsMono_700Bold', fontSize: 22 },
  priceMd:        { fontFamily: 'JetBrainsMono_700Bold', fontSize: 18 },
  priceSm:        { fontFamily: 'JetBrainsMono_700Bold', fontSize: 13 },
  eyebrow:        { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10.5, letterSpacing: 1.3, textTransform: 'uppercase' as const },
} as const;

export type ThemeColor = keyof typeof T;
export type TypePreset = keyof typeof TYPE;
