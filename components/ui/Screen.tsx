import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconButton } from './Button';
import { useResponsive } from '../../lib/responsive';
import { colors, layout, space, text } from '../../constants/theme';

type ScreenProps = {
  children: React.ReactNode;
  /** Fixed bar above the scroll area (back buttons, modal-style titles). */
  topBar?: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Extra bottom clearance so the floating tab bar never covers content. */
  tabBar?: boolean;
  padded?: boolean;
  gap?: number;
};

/**
 * Page chrome: safe area, background, optional pull-to-refresh, and a content
 * column that stops growing on tablets instead of stretching edge to edge.
 */
export function Screen({
  children, topBar, scroll = true, refreshing, onRefresh, tabBar = true, padded = true, gap = space.lg,
}: ScreenProps) {
  const { gutter } = useResponsive();

  const body = (
    <View style={[s.column, !scroll && s.fill, padded && { paddingHorizontal: gutter }, { gap }]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {topBar}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            s.scroll,
            { paddingBottom: tabBar ? layout.tabBarSpace : space.xxxl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh
              ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} />
              : undefined
          }
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

// ─── Headers ──────────────────────────────────────────────────────────────────

type HeaderProps = {
  title: string;
  subtitle?: string;
  /** Rendered at the far right — actions, avatars, counters. */
  right?: React.ReactNode;
  /** Rendered directly under the title — branch switchers, filters. */
  below?: React.ReactNode;
};

/** In-scroll page title. Large, quiet subtitle, optional trailing slot. */
export function ScreenHeader({ title, subtitle, right, below }: HeaderProps) {
  return (
    <View style={h.wrap}>
      <View style={h.row}>
        <View style={h.titleBox}>
          {!!subtitle && <Text style={text.small}>{subtitle}</Text>}
          <Text style={text.title} numberOfLines={1}>{title}</Text>
        </View>
        {right}
      </View>
      {below}
    </View>
  );
}

/** Fixed bar for pushed routes (users, branches) with a back affordance. */
export function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: React.ReactNode }) {
  return (
    <View style={h.topBar}>
      {onBack ? <IconButton icon="chevron-back" onPress={onBack} label="Back" size={38} /> : <View style={h.spacer} />}
      <Text style={text.h2} numberOfLines={1}>{title}</Text>
      {right ?? <View style={h.spacer} />}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, paddingTop: space.sm },
  column: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  // A child that scrolls itself (PagedList) needs the column to fill the page.
  fill: { flex: 1, maxWidth: undefined },
});

const h = StyleSheet.create({
  wrap: { gap: space.lg, paddingTop: space.sm, paddingBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  titleBox: { flex: 1, gap: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  spacer: { width: 38 },
});
