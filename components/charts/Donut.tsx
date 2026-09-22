import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors, moneyCompact, space, text } from '../../constants/theme';

export type Slice = { label: string; value: number };

type Props = {
  data: Slice[];
  size?: number;
  /** Shown in the hole; defaults to the total. */
  centerLabel?: string;
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arc(cx: number, cy: number, r: number, inner: number, from: number, to: number) {
  const large = to - from > 180 ? 1 : 0;
  const s = polar(cx, cy, r, from);
  const e = polar(cx, cy, r, to);
  const si = polar(cx, cy, inner, from);
  const ei = polar(cx, cy, inner, to);
  return [
    `M ${s.x} ${s.y}`,
    `A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`,
    `L ${ei.x} ${ei.y}`,
    `A ${inner} ${inner} 0 ${large} 0 ${si.x} ${si.y}`,
    'Z',
  ].join(' ');
}

/** Donut split by share, drawn down the gray ramp from black (largest) outward. */
export function Donut({ data, size = 150, centerLabel }: Props) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (!data.length || total <= 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 2;
  const inner = outer * 0.62;
  const gap = data.length > 1 ? 2 : 0;

  const ordered = [...data].sort((a, b) => b.value - a.value);
  let cursor = 0;
  const slices = ordered.map((d, idx) => {
    const sweep = (d.value / total) * (360 - gap * ordered.length);
    const from = cursor + idx * gap;
    cursor += sweep;
    return { ...d, from, to: from + sweep, color: colors.series[idx % colors.series.length] };
  });

  return (
    <View style={s.wrap}>
      <View>
        <Svg width={size} height={size}>
          <G>
            {slices.map((slice, idx) => (
              <Path key={idx} d={arc(cx, cy, outer, inner, slice.from, slice.to)} fill={slice.color} />
            ))}
            <Circle cx={cx} cy={cy} r={inner - 1} fill={colors.surface} />
          </G>
        </Svg>
        <View style={[StyleSheet.absoluteFillObject, s.center]}>
          <Text style={text.h2}>{centerLabel ?? moneyCompact(total)}</Text>
          <Text style={text.micro}>Total</Text>
        </View>
      </View>

      <View style={s.legend}>
        {slices.map((slice, idx) => (
          <View key={idx} style={s.legendRow}>
            <View style={[s.swatch, { backgroundColor: slice.color }]} />
            <Text style={[text.caption, s.legendLabel]} numberOfLines={1}>{slice.label}</Text>
            <Text style={text.micro}>{((slice.value / total) * 100).toFixed(0)}%</Text>
            <Text style={[text.smallStrong, s.legendValue]}>{moneyCompact(slice.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  center: { alignItems: 'center', justifyContent: 'center' },
  legend: { flex: 1, gap: space.md },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, color: colors.text },
  legendValue: { minWidth: 48, textAlign: 'right' },
});
