import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { Colors } from '../constants/colors';

export type BranchSlice = {
  label: string;
  value: number;
};

type Props = {
  data: BranchSlice[];
  size?: number;
};

const GRAYS = [
  Colors.gray900,
  Colors.gray600,
  Colors.gray400,
  Colors.gray300,
  Colors.gray200,
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function slicePath(cx: number, cy: number, r: number, inner: number, startAngle: number, endAngle: number) {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const s = polarToCartesian(cx, cy, r, startAngle);
  const e = polarToCartesian(cx, cy, r, endAngle);
  const si = polarToCartesian(cx, cy, inner, startAngle);
  const ei = polarToCartesian(cx, cy, inner, endAngle);
  return [
    `M ${s.x} ${s.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`,
    `L ${ei.x} ${ei.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${si.x} ${si.y}`,
    'Z',
  ].join(' ');
}

export function BranchPieChart({ data, size = 180 }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (!data.length || total === 0) {
    return (
      <View style={styles.wrapper}>
        <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>No data</Text>
      </View>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.52;
  const gap = 2;

  let cursor = 0;
  const slices = data.map((d, i) => {
    const sweep = (d.value / total) * (360 - gap * data.length);
    const start = cursor + i * gap;
    const end = start + sweep;
    cursor += sweep;
    return { ...d, start, end, color: GRAYS[i % GRAYS.length] };
  });

  const topBranch = [...data].sort((a, b) => b.value - a.value)[0];

  return (
    <View style={styles.wrapper}>
      {/* Donut */}
      <View style={styles.chartWrap}>
        <Svg width={size} height={size}>
          <G>
            {slices.map((s, i) => (
              <Path
                key={i}
                d={slicePath(cx, cy, outerR, innerR, s.start, s.end)}
                fill={s.color}
              />
            ))}
            {/* center hole background */}
            <Circle cx={cx} cy={cy} r={innerR - 1} fill={Colors.white} />
          </G>
        </Svg>
        {/* Center label */}
        <View style={[styles.center, { width: innerR * 2 - 8, height: innerR * 2 - 8 }]}>
          <Text style={styles.centerValue}>${(topBranch.value / 1000).toFixed(1)}k</Text>
          <Text style={styles.centerLabel} numberOfLines={1}>{topBranch.label}</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {slices.map((s, i) => {
          const pct = ((s.value / total) * 100).toFixed(1);
          return (
            <View key={i} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>{s.label}</Text>
              <Text style={styles.legendPct}>{pct}%</Text>
              <Text style={styles.legendValue}>${(s.value / 1000).toFixed(1)}k</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  chartWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  centerLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  legend: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  legendPct: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    width: 38,
    textAlign: 'right',
  },
  legendValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    width: 40,
    textAlign: 'right',
  },
});
