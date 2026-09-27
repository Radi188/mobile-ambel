/**
 * HTTP client — currently unused.
 *
 * The app runs entirely on the mock backend in `services/mock/` while the
 * server API is being replaced. This file is kept intact because the plumbing
 * (bearer token, branch header, FormData handling, error normalisation) is
 * what the new API will need; point BASE_URL at it and reimplement the service
 * modules against `api` again.
 */
import axios from 'axios';
import { storage } from './storage';

/** Production server — used unless a custom server is set on the login screen. */
export const BASE_URL = 'https://api.bongpos.com';

/** The server requests go to: the saved override, or production. */
export async function getBaseUrl() {
  return (await storage.getBaseUrl()) ?? BASE_URL;
}

/**
 * Saves a custom server. Saving the production URL (or an empty value) clears
 * the override, so the app follows BASE_URL again.
 */
export async function setBaseUrl(url: string) {
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean || clean === BASE_URL) await storage.removeBaseUrl();
  else await storage.setBaseUrl(clean);
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  config.baseURL = await getBaseUrl();

  const token = await storage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const branchId = await storage.getBranchId();
  if (branchId) config.headers['x-branch-id'] = branchId;

  // React Native is not a "standard browser env", so axios leaves our
  // Content-Type in place for FormData bodies. Setting multipart/form-data by
  // hand omits the boundary and the server can't parse the body — dropping the
  // header lets RN's XHR generate `multipart/form-data; boundary=...` itself.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
    config.timeout = 60_000; // uploads need more headroom than the 10s default
  }

  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.message ?? error.message ?? 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default api;
