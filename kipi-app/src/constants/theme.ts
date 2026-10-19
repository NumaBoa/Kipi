/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const KipiPalette = {
  pistachio: '#B9C255',
  pistachioDark: '#949D39',
  pistachioLight: '#F3F6DD',
  frost: '#E6F1FA',
  frostDeep: '#D4E6F6',
  icedDenim: '#5798D7',
  icedDenimDark: '#3E7BB8',
  icedDenimLight: '#EAF3FA',
  white: '#FFFFFF',
  slateDark: '#0F172A',
  slate: '#1E293B',
  slateMedium: '#475569',
  slateLight: '#64748B',
  border: '#E2E8F0',
  inputBg: '#F8FAFC',
  googleBorder: '#E2E8F0',
} as const;

export const Colors = {
  light: {
    text: KipiPalette.slate,
    background: KipiPalette.frost,
    backgroundElement: '#FFFFFF',
    backgroundSelected: KipiPalette.frostDeep,
    textSecondary: KipiPalette.slateLight,
    primary: KipiPalette.icedDenim,
    accent: KipiPalette.pistachio,
  },
  dark: {
    text: '#ffffff',
    background: '#0F172A',
    backgroundElement: '#1E293B',
    backgroundSelected: '#334155',
    textSecondary: '#94A3B8',
    primary: KipiPalette.icedDenim,
    accent: KipiPalette.pistachio,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    display: 'System',
    sans: 'System',
    editorial: 'System',
    mono: 'ui-monospace',
    serif: 'System',
    rounded: 'ui-rounded',
  },
  android: {
    display: 'sans-serif-medium',
    sans: 'sans-serif',
    editorial: 'sans-serif-medium',
    mono: 'monospace',
    serif: 'sans-serif',
    rounded: 'sans-serif',
  },
  web: {
    display: '"Sora", "Plus Jakarta Sans", -apple-system, sans-serif',
    sans: '"Manrope", "Plus Jakarta Sans", -apple-system, sans-serif',
    editorial: '"Sora", -apple-system, sans-serif',
    mono: 'monospace',
    serif: '"Sora", -apple-system, sans-serif',
    rounded: '"Sora", -apple-system, sans-serif',
  },
  default: {
    display: 'normal',
    sans: 'normal',
    editorial: 'normal',
    mono: 'monospace',
    serif: 'normal',
    rounded: 'normal',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
