import { ActivityIndicator, FlatList, ListRenderItem, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Press } from './Press';
import { useResponsive } from '../../lib/responsive';
import { colors, layout, radius, shadow, space, text } from '../../constants/theme';

type Props<T> = {
  data: T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  /** Everything above the list: titles, hero cards, search, filter chips. */
  header?: React.ReactNode;
  /** Shown in place of the list when it is empty and not loading. */
  empty?: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  loadingMore: boolean;
  hasMore: boolean;
  total: number;
  /** 'rows' joins items into one card; 'grid' lays out standalone tiles. */
  variant?: 'rows' | 'grid';
  columns?: number;
  /** Leave clearance for the floating tab bar. */
  tabBar?: boolean;
  /** Word for the footer counter, e.g. "orders". */
  noun?: string;
};

/**
 * The list surface behind every paged screen: pull-to-refresh, infinite scroll
 * and an end-of-list footer, with the page header scrolling along as part of
 * the list so there's only ever one scroll view on screen.
 */
export function PagedList<T>({
  data, renderItem, keyExtractor, header, empty,
  refreshing, onRefresh, onEndReached, loadingMore, hasMore, total,
  variant = 'rows', columns = 1, tabBar = true, noun = 'items',
}: Props<T>) {
  const { gutter } = useResponsive();
  const grid = variant === 'grid';

  return (
    <FlatList
      // numColumns can't change on a live list — remounting on breakpoint change is the supported way.
      key={grid ? `grid-${columns}` : 'rows'}
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={grid ? columns : 1}
      columnWrapperStyle={grid && columns > 1 ? { gap: space.md } : undefined}
      contentContainerStyle={[
        s.content,
        {
          paddingHorizontal: gutter,
          paddingBottom: tabBar ? layout.tabBarSpace : space.xxxl,
          gap: grid ? space.md : 0,
        },
      ]}
      ListHeaderComponent={header ? <View style={s.header}>{header}</View> : null}
      ListEmptyComponent={empty ? <View style={s.empty}>{empty}</View> : null}
      ListFooterComponent={
        <ListFooter
          loading={loadingMore}
          hasMore={hasMore}
          shown={data.length}
          total={total}
          noun={noun}
          onLoadMore={onEndReached}
        />
      }
      ItemSeparatorComponent={grid ? null : Separator}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.45}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      removeClippedSubviews={false}
    />
  );
}

function Separator() {
  return <View style={s.separator} />;
}

/** Wraps a row so a column of them reads as one card. */
export function RowCard({ children, first, last }: { children: React.ReactNode; first: boolean; last: boolean }) {
  return (
    <View style={[s.rowCard, first && s.rowCardFirst, last && s.rowCardLast]}>
      {children}
    </View>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function ListFooter({ loading, hasMore, shown, total, noun, onLoadMore }: {
  loading: boolean;
  hasMore: boolean;
  shown: number;
  total: number;
  noun: string;
  onLoadMore: () => void;
}) {
  if (shown === 0) return null;

  if (loading) {
    return (
      <View style={s.footer}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
        <Text style={text.micro}>Loading more…</Text>
      </View>
    );
  }

  // onEndReached can be missed on short or fast scrolls, so the count doubles
  // as a manual tap target.
  if (hasMore) {
    return (
      <Press onPress={onLoadMore} scaleTo={0.97} style={s.loadMore}>
        <Text style={text.smallStrong}>Load more</Text>
        <Text style={text.micro}>
          {shown}{total > 0 ? ` of ${total.toLocaleString()}` : ''} {noun}
        </Text>
      </Press>
    );
  }

  return (
    <View style={s.footer}>
      <View style={s.endRule} />
      <Text style={text.micro}>
        {total > 0 ? `All ${total.toLocaleString()} ${noun}` : `${shown} ${noun}`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingTop: space.sm,
  },
  header: { gap: space.lg, paddingBottom: space.lg },
  empty: { paddingTop: space.sm },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: space.lg },

  rowCard: {
    backgroundColor: colors.surface,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  rowCardFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...shadow.xs,
  },
  rowCardLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },

  footer: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  endRule: { width: 24, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
  loadMore: {
    alignItems: 'center',
    gap: 2,
    marginTop: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
