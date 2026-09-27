import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import { Paginated } from '../types/api.types';

type Mode = 'initial' | 'refresh' | 'more';

export type PagedList<T> = {
  items: T[];
  /** Total matching records reported by the server (0 if it doesn't count). */
  total: number;
  hasMore: boolean;
  /** First load, or a reload caused by a filter change. */
  loading: boolean;
  /** Pull-to-refresh in flight. */
  refreshing: boolean;
  /** Next page in flight. */
  loadingMore: boolean;
  error: string | null;
  refresh: () => void;
  loadMore: () => void;
  /** Re-run the current query from page 1, e.g. after a create or delete. */
  reload: () => void;
};

/**
 * Drives every paged list in the app: page state, pull-to-refresh, infinite
 * scroll, and reloads when filters change.
 *
 * `fetchPage` is called with a 1-based page number and must resolve a
 * `Paginated<T>` envelope. The API returns whole lists; the services slice
 * them into pages (services/shape.ts `paginate`), so the screens never know.
 * `deps` are the filters: whenever one changes the list resets to page 1.
 *
 * Responses from superseded requests are dropped, so fast typing in a search
 * box can't let a slow early page overwrite a newer one.
 */
export function usePaginatedList<T>(
  fetchPage: (page: number) => Promise<Paginated<T>>,
  deps: DependencyList,
): PagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The fetcher closes over the current filters and changes every render, so it
  // lives in a ref rather than in the effect's dependency list.
  const fetcher = useRef(fetchPage);
  fetcher.current = fetchPage;

  const requestId = useRef(0);
  const pageRef = useRef(1);

  const run = useCallback(async (page: number, mode: Mode) => {
    const id = ++requestId.current;
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'more') setLoadingMore(true);

    try {
      const result = await fetcher.current(page);
      if (id !== requestId.current) return; // a newer request already won

      setItems(prev => (mode === 'more' ? [...prev, ...result.items] : result.items));
      setTotal(result.total);
      setHasMore(result.hasMore);
      pageRef.current = result.page;
      setError(null);
    } catch (e: any) {
      if (id !== requestId.current) return;
      setError(e?.message ?? 'Something went wrong.');
      if (mode !== 'more') {
        setItems([]);
        setTotal(0);
        setHasMore(false);
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, []);

  // Filters changed (or first mount): back to page 1.
  useEffect(() => {
    pageRef.current = 1;
    run(1, 'initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = useCallback(() => {
    pageRef.current = 1;
    run(1, 'refresh');
  }, [run]);

  const reload = useCallback(() => {
    pageRef.current = 1;
    run(1, 'initial');
  }, [run]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || refreshing || loadingMore) return;
    run(pageRef.current + 1, 'more');
  }, [run, hasMore, loading, refreshing, loadingMore]);

  return { items, total, hasMore, loading, refreshing, loadingMore, error, refresh, loadMore, reload };
}
