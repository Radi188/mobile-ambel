import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Circle } from 'react-native-svg';
import { colors, palette } from '../../constants/theme';

type Props = {
  values: number[];
  height?: number;
  onDark?: boolean;
  /** Marks the latest point with a dot — useful when the line ends mid-card. */
  marker?: boolean;
};

/** Smooths the polyline through midpoints so the trend reads as a curve. */
function buildPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const midX = (prev.x + cur.x) / 2;
    d += ` Q ${prev.x} ${prev.y} ${midX} ${(prev.y + cur.y) / 2}`;
    d += ` Q ${cur.x} ${cur.y} ${cur.x} ${cur.y}`;
  }
  return d;
}

export function Sparkline({ values, height = 64, onDark, marker = true }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const ink = onDark ? palette.white : colors.text;
  const pad = 4;

  let body = null;
  if (width > 0 && values.length > 1) {
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const step = (width - pad * 2) / (values.length - 1);

    const points = values.map((v, idx) => ({
      x: pad + idx * step,
      y: pad + (1 - (v - min) / span) * (height - pad * 2),
    }));

    const line = buildPath(points);
    const area = `${line} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
    const last = points[points.length - 1];

    body = (
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sparkFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={ink} stopOpacity={onDark ? 0.34 : 0.14} />
            <Stop offset="1" stopColor={ink} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#sparkFade)" />
        <Path d={line} stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {marker && <Circle cx={last.x} cy={last.y} r={3.5} fill={ink} />}
      </Svg>
    );
  }

  return <View style={[s.wrap, { height }]} onLayout={onLayout}>{body}</View>;
}

const s = StyleSheet.create({
  wrap: { width: '100%', justifyContent: 'center' },
});
