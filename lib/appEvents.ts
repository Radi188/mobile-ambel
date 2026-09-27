/**
 * A tiny app-wide event bus, for the few things that have to cross from the
 * HTTP layer into React — e.g. a 401 from any request signing the user out.
 */

export const EVENTS = {
  AUTH_LOGOUT: 'auth:logout',
} as const;

type Handler = () => void;
const handlers = new Map<string, Set<Handler>>();

export const appEvents = {
  on(event: string, fn: Handler) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(fn);
    return () => { handlers.get(event)?.delete(fn); };
  },
  emit(event: string) {
    handlers.get(event)?.forEach(fn => { try { fn(); } catch { /* keep going */ } });
  },
};
