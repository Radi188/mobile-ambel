import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which API this app talks to — switchable from the login screen, so one build
 * can be pointed at production, a staging server or a laptop on the shop's
 * Wi-Fi without a rebuild. Ported from ambel-mobile's services/serverConfig.
 *
 * Production is the default; a URL picked on the login screen overrides it and
 * is kept on the device. Everything that needs the URL reads it from here at
 * call time (the axios client subscribes to changes) rather than capturing a
 * constant at import.
 */

/** The production API. Every build starts here. */
export const PRODUCTION_API_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.bongpos.com';

const KEY = '@ambel_api_base_url';

/** The servers offered on the login screen. The first is the build's own. */
export const SERVER_PRESETS = [{ label: 'Production', url: PRODUCTION_API_URL }];

let current = PRODUCTION_API_URL;
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

export const getApiBaseUrl = () => current;
export const isCustomServer = () => current !== PRODUCTION_API_URL;

/** Call `fn(url)` whenever the server changes. Returns an unsubscribe. */
export function onApiBaseUrlChange(fn: (url: string) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function apply(url: string) {
  current = url;
  listeners.forEach(fn => { try { fn(url); } catch { /* one bad listener must not stop the rest */ } });
}

/** Restore the saved choice. Called once at boot, before the first request. */
export async function loadApiBaseUrl() {
  try {
    const url = normaliseBaseUrl(await AsyncStorage.getItem(KEY));
    if (url && url !== current) apply(url);
  } catch { /* storage unavailable — keep production */ }
  return current;
}

/** Switch server and remember it. Passing production (or '') forgets the override. */
export async function setApiBaseUrl(input: string) {
  const url = normaliseBaseUrl(input) || PRODUCTION_API_URL;
  if (url === PRODUCTION_API_URL) await AsyncStorage.removeItem(KEY).catch(() => {});
  else await AsyncStorage.setItem(KEY, url).catch(() => {});
  apply(url);
  return url;
}

export type ServerTest =
  | { ok: true; status: number; ms: number }
  | { ok: false; status?: number; error: string };

/**
 * Is there an API at `url`? Any HTTP answer below 500 counts — the root of a
 * NestJS API is a 404, which still proves the server is there.
 */
export async function testServer(input: string, timeoutMs = 8000): Promise<ServerTest> {
  const url = normaliseBaseUrl(input);
  if (!url) return { ok: false, error: 'That doesn’t look like a web address.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
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
