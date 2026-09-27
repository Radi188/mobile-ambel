import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY  = '@ambel_token';
const BRANCH_KEY = '@ambel_branch_id';

/**
 * Session storage, as ambel-mobile's tokenService does it: AsyncStorage is
 * async, but the axios request interceptor wants the token synchronously, so an
 * in-memory cache mirrors what is persisted.
 *  - `init()` hydrates the cache once at startup (awaited before the first request)
 *  - the `…Sync` getters read the cache
 *  - setters update the cache immediately and persist in the background
 *
 * The async getters are kept so existing call sites don't change.
 */
const cache: { token: string | null; branchId: string | null } = { token: null, branchId: null };

const persist = (key: string, value: string | null) =>
  (value == null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, value)).catch(() => {});

export const storage = {
  init: async () => {
    try {
      const [token, branchId] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(BRANCH_KEY),
      ]);
      cache.token = token;
      cache.branchId = branchId;
    } catch {
      // Storage unavailable — start signed out.
    }
  },

  getTokenSync:    () => cache.token,
  getBranchIdSync: () => cache.branchId,

  getToken:    async () => cache.token,
  setToken:    async (token: string) => { cache.token = token; await persist(TOKEN_KEY, token); },
  removeToken: async () => { cache.token = null; await persist(TOKEN_KEY, null); },

  getBranchId:    async () => cache.branchId,
  setBranchId:    async (id: string) => { cache.branchId = id; await persist(BRANCH_KEY, id); },
  removeBranchId: async () => { cache.branchId = null; await persist(BRANCH_KEY, null); },

  clear: async () => {
    cache.token = null;
    cache.branchId = null;
    await AsyncStorage.multiRemove([TOKEN_KEY, BRANCH_KEY]).catch(() => {});
  },
};
