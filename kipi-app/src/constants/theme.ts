/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const KipiPalette = {
  pistachio: '#B06A2C',
  pistachioDark: '#8A5530',
  pistachioLight: '#F6E8D6',
  frost: '#F8F6F2',
  frostDeep: '#ECEBFA',
  icedDenim: '#4B4FC4',
  icedDenimDark: '#3A3D9E',
  caramelo: '#9E5D25',
  carameloMarca: '#B06A2C',
  carameloEscuro: '#7A4520',
  carameloClaro: '#F6E8D6',
  icedDenimLight: '#ECEBFA',
  white: '#FFFDFA',
  slateDark: '#2E211A',
  slate: '#2E211A',
  slateMedium: '#4A3E37',
  slateLight: '#6B615A',
  border: '#E8E0D6',
  inputBg: '#F8F6F2',
  googleBorder: '#E8E0D6',
} as const;

export const Colors = {
  light: {
    text: KipiPalette.slate,
    background: KipiPalette.frost,
    backgroundElement: '#FFFDFA',
    backgroundSelected: KipiPalette.frostDeep,
    textSecondary: KipiPalette.slateLight,
    primary: KipiPalette.icedDenim,
    accent: KipiPalette.pistachio,
  },
  dark: {
    text: '#FFFDFA',
    background: '#2E211A',
    backgroundElement: '#2E211A',
    backgroundSelected: '#3D312A',
    textSecondary: '#9A8F87',
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
    display: '"Bricolage Grotesque", "Instrument Sans", -apple-system, sans-serif',
    sans: '"Instrument Sans", "Instrument Sans", -apple-system, sans-serif',
    editorial: '"Bricolage Grotesque", -apple-system, sans-serif',
    mono: 'monospace',
    serif: '"Bricolage Grotesque", -apple-system, sans-serif',
    rounded: '"Bricolage Grotesque", -apple-system, sans-serif',
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
