import { StyleSheet, Text, View } from 'react-native';
import { colors, space, text } from '../../constants/theme';

type Props = {
  label: string;
  sub?: string;
  value: number;
  max: number;
  /** Pre-formatted figure shown on the right (money, units…). */
  display: string;
  /** 1-based position; the leader is filled black, the rest gray. */
  rank?: number;
};

/** Horizontal ranking bar used by the product and cashier leaderboards. */
export function RankBar({ label, sub, value, max, display, rank }: Props) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const lead = rank === 1;

  return (
    <View style={s.wrap}>
      <View style={s.top}>
        {rank != null && (
          <View style={[s.rank, lead && s.rankLead]}>
            <Text style={[s.rankText, lead && s.rankTextLead]}>{rank}</Text>
          </View>
        )}
        <View style={s.copy}>
          <Text style={text.smallStrong} numberOfLines={1}>{label}</Text>
          {!!sub && <Text style={text.micro} numberOfLines={1}>{sub}</Text>}
        </View>
        <Text style={text.money} numberOfLines={1}>{display}</Text>
      </View>
      <View style={s.track}>
        <View style={[s.fill, lead && s.fillLead, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: space.sm, paddingVertical: space.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  copy: { flex: 1, gap: 1 },
  rank: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceSunken,
  },
  rankLead: { backgroundColor: colors.accent },
  rankText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  rankTextLead: { color: colors.textInverse },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.borderStrong },
  fillLead: { backgroundColor: colors.accent },
});
