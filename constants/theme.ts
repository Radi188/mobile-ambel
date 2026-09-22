import { StyleSheet, TextStyle, ViewStyle } from 'react-native';

/**
 * Monochrome design system.
 *
 * White surfaces, black ink, one neutral gray ramp — no hue anywhere. State that
 * would normally be carried by colour (status, emphasis, danger) is carried by
 * fill, weight and border instead. Screens never declare a raw hex; everything
 * resolves to a token here.
 */

// ─── Ramp ─────────────────────────────────────────────────────────────────────

export const palette = {
  white:  '#FFFFFF',
  gray25: '#FCFCFC',
  gray50: '#FAFAFA',
  gray100:'#F4F4F4',
  gray150:'#EEEEEE',
  gray200:'#E5E5E5',
  gray300:'#D4D4D4',
  gray400:'#A3A3A3',
  gray500:'#737373',
  gray600:'#525252',
  gray700:'#404040',
  gray800:'#262626',
  gray900:'#171717',
  black:  '#0A0A0A',
} as const;

// ─── Semantic tokens ──────────────────────────────────────────────────────────

export const colors = {
  // Surfaces
  background:     palette.gray50,
  surface:        palette.white,
  surfaceSunken:  palette.gray100,
  surfaceInverse: palette.black,
  overlay:        'rgba(10,10,10,0.45)',

  // Lines
  border:         palette.gray200,
  borderStrong:   palette.gray300,
  divider:        palette.gray150,
  borderInverse:  'rgba(255,255,255,0.14)',

  // Ink
  text:           palette.black,
  textSecondary:  palette.gray500,
  textTertiary:   palette.gray400,
  textInverse:    palette.white,
  textInverseSub: 'rgba(255,255,255,0.64)',
  textInverseDim: 'rgba(255,255,255,0.42)',

  // Interactive
  accent:         palette.black,
  accentSoft:     palette.gray100,

  // Data — ordered dark → light so the first series always reads strongest
  series:        [palette.black, palette.gray600, palette.gray400, palette.gray300, palette.gray200] as string[],
  track:          palette.gray150,
  trackInverse:   'rgba(255,255,255,0.16)',
  fillInverse:    'rgba(255,255,255,0.10)',
} as const;

// ─── Metrics ──────────────────────────────────────────────────────────────────

/** 4pt grid. Use these instead of literal padding numbers. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  xxl: 32,
  pill: 999,
} as const;

export const layout = {
  /** Horizontal screen gutter. */
  gutter: 20,
  /** Content stops growing past this so tablets don't stretch a phone layout. */
  maxContentWidth: 760,
  /** Clearance the floating tab bar needs at the bottom of a scroll view. */
  tabBarSpace: 108,
  hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
} as const;

// ─── Elevation ────────────────────────────────────────────────────────────────

type Shadow = Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>;

const makeShadow = (y: number, blur: number, opacity: number, elevation: number): Shadow => ({
  shadowColor: palette.black,
  shadowOffset: { width: 0, height: y },
  shadowOpacity: opacity,
  shadowRadius: blur,
  elevation,
});

export const shadow = {
  none: { shadowOpacity: 0, elevation: 0 } as Shadow,
  xs:   makeShadow(1, 2, 0.04, 1),
  sm:   makeShadow(2, 8, 0.06, 2),
  md:   makeShadow(6, 18, 0.08, 6),
  lg:   makeShadow(12, 28, 0.12, 12),
} as const;

// ─── Type scale ───────────────────────────────────────────────────────────────

/** Tabular figures keep money columns from jittering as values change. */
const numeric: TextStyle = { fontVariant: ['tabular-nums'] };

export const text = StyleSheet.create({
  display:   { fontSize: 40, fontWeight: '800', letterSpacing: -1.6, color: colors.text, ...numeric },
  title:     { fontSize: 28, fontWeight: '700', letterSpacing: -0.7, color: colors.text },
  h1:        { fontSize: 22, fontWeight: '700', letterSpacing: -0.4, color: colors.text },
  h2:        { fontSize: 17, fontWeight: '600', letterSpacing: -0.3, color: colors.text },
  h3:        { fontSize: 15, fontWeight: '600', letterSpacing: -0.1, color: colors.text },
  body:      { fontSize: 15, fontWeight: '400', color: colors.text },
  bodyStrong:{ fontSize: 15, fontWeight: '600', color: colors.text },
  small:     { fontSize: 13, fontWeight: '400', color: colors.textSecondary },
  smallStrong:{ fontSize: 13, fontWeight: '600', color: colors.text },
  caption:   { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  micro:     { fontSize: 11, fontWeight: '500', color: colors.textTertiary },
  overline:  { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, color: colors.textTertiary, textTransform: 'uppercase' },
  metric:    { fontSize: 26, fontWeight: '700', letterSpacing: -1, color: colors.text, ...numeric },
  money:     { fontSize: 15, fontWeight: '700', color: colors.text, ...numeric },
});

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** `$1,240` — whole dollars, for headline figures. */
export function money(v: unknown): string {
  return `$${toNumber(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** `$12.40` — cents, for line items and totals. */
export function money2(v: unknown): string {
  return `$${toNumber(v).toFixed(2)}`;
}

/** `$1.2k` — for chips and axis labels where space is tight. */
export function moneyCompact(v: unknown): string {
  const n = toNumber(v);
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export function count(v: unknown): string {
  return toNumber(v).toLocaleString();
}

/** `3 items` / `1 item` */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}
