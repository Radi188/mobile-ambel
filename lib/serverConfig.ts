import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which API this app talks to — switchable from the login screen, so one build
 * can sign in to BongPOS or Ambel, or point either at a staging server or a
 * laptop on the shop's Wi-Fi, without a rebuild. Ported from ambel-mobile's
 * services/serverConfig.
 *
 * BongPOS production is the default; the backend and address picked on the
 * login screen are kept on the device. Everything that needs them reads them
 * from here at call time (the axios client subscribes to changes) rather than
 * capturing a constant at import.
 */

export type Backend = 'bongpos' | 'ambel';

/**
 * The two APIs this app speaks. They are different servers with different
 * contracts — BongPOS signs in by email, Ambel (api-ambel) by username — so the
 * services pick an implementation per backend (services/bongpos, services/ambel).
 */
export const BACKENDS: Record<Backend, { label: string; url: string }> = {
  bongpos: {
    label: 'BongPOS',
    url: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.bongpos.com',
  },
  ambel: {
    label: 'Ambel',
    url: process.env.EXPO_PUBLIC_AMBEL_API_URL ?? 'https://ambel.crosscambodia.com/api',
  },
};

export const BACKEND_KEYS = Object.keys(BACKENDS) as Backend[];

const BACKEND_KEY = '@ambel_backend';
const urlKey = (backend: Backend) => `@ambel_api_base_url:${backend}`;
// Before the split there was one override, always for BongPOS.
const LEGACY_URL_KEY = '@ambel_api_base_url';

let backend: Backend = 'bongpos';
let current = BACKENDS.bongpos.url;
const listeners = new Set<(url: string) => void>();

/**
 * Tidy what someone typed: add http(s):// when no scheme was given, drop
 * trailing slashes. Returns '' for something that is not a URL at all.
 *
 * A bare LAN address ("192.168.1.7:3000") gets http:// — a laptop on the shop's
 * Wi-Fi won't have a certificate — anything else gets https://.
 */
export function normaliseBaseUrl(input: string | null | undefined): string {
  let url = String(input ?? '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url);
    url = `${local ? 'http' : 'https'}://${url}`;
  }
  url = url.replace(/\/+$/, '');
  return /^https?:\/\/[^\s/]+/i.test(url) ? url : '';
}

export const getBackend = () => backend;
export const getApiBaseUrl = () => current;
export const isCustomServer = () => current !== BACKENDS[backend].url;

/** Call `fn(url)` whenever the server changes. Returns an unsubscribe. */
export function onApiBaseUrlChange(fn: (url: string) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function apply(next: Backend, url: string) {
  backend = next;
  current = url;
  listeners.forEach(fn => { try { fn(url); } catch { /* one bad listener must not stop the rest */ } });
}

const isBackend = (value: unknown): value is Backend => BACKEND_KEYS.includes(value as Backend);

/** Restore the saved backend and its address. Called once at boot, before the first request. */
export async function loadServer() {
  try {
    const legacy = normaliseBaseUrl(await AsyncStorage.getItem(LEGACY_URL_KEY));
    if (legacy) {
      // An Ambel address saved before the split becomes the Ambel side.
      const isAmbel = legacy === BACKENDS.ambel.url;
      await AsyncStorage.multiSet([
        [BACKEND_KEY, isAmbel ? 'ambel' : 'bongpos'],
        ...(isAmbel || legacy === BACKENDS.bongpos.url ? [] : [[urlKey('bongpos'), legacy] as [string, string]]),
      ]);
      await AsyncStorage.removeItem(LEGACY_URL_KEY);
    }
    const saved = await AsyncStorage.getItem(BACKEND_KEY);
    const next = isBackend(saved) ? saved : 'bongpos';
    const url = normaliseBaseUrl(await AsyncStorage.getItem(urlKey(next))) || BACKENDS[next].url;
    if (next !== backend || url !== current) apply(next, url);
  } catch { /* storage unavailable — keep BongPOS production */ }
  return { backend, url: current };
}

/** The address a backend would use on this device: its override, or its default. */
export async function savedUrlFor(next: Backend) {
  const saved = await AsyncStorage.getItem(urlKey(next)).catch(() => null);
  return normaliseBaseUrl(saved) || BACKENDS[next].url;
}

/**
 * Switch backend (and optionally its address) and remember both. Without
 * `input` the backend's own saved address is used; its default (or '') forgets
 * the override.
 */
export async function setServer(next: Backend, input?: string) {
  const url = input === undefined ? await savedUrlFor(next) : normaliseBaseUrl(input) || BACKENDS[next].url;
  if (url === BACKENDS[next].url) await AsyncStorage.removeItem(urlKey(next)).catch(() => {});
  else await AsyncStorage.setItem(urlKey(next), url).catch(() => {});
  await AsyncStorage.setItem(BACKEND_KEY, next).catch(() => {});
  apply(next, url);
  return { backend: next, url };
}

export type ServerTest =
  | { ok: true; status: number; ms: number }
  | { ok: false; status?: number; error: string };

/**
 * Is there an API at `url`? For BongPOS any HTTP answer below 500 counts — the
 * root of a NestJS API is a 404, which still proves the server is there. For
 * Ambel `/auth/me` must exist (a 401 without a session is the right answer),
 * which also catches an address missing its `/api` prefix.
 */
export async function testServer(input: string, target: Backend = 'bongpos', timeoutMs = 8000): Promise<ServerTest> {
  const url = normaliseBaseUrl(input);
  if (!url) return { ok: false, error: 'That doesn’t look like a web address.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const probe = target === 'ambel' ? `${url}/auth/me` : url;
    const res = await fetch(probe, { method: 'GET', signal: controller.signal });
    if (target === 'ambel' && res.status === 404) {
      return { ok: false, status: 404, error: 'No Ambel API at this address. Does it end in /api?' };
    }
    if (res.status >= 500) {
      return { ok: false, status: res.status, error: `The server answered with an error (${res.status}).` };
    }
    return { ok: true, status: res.status, ms: Date.now() - started };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.name === 'AbortError' ? `No answer within ${timeoutMs / 1000} seconds.` : 'Can’t reach that address.',
    };
  } finally {
    clearTimeout(timer);
  }
}
