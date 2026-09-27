import axios, { AxiosRequestConfig } from 'axios';
import { storage } from './storage';
import { getApiBaseUrl, onApiBaseUrlChange } from './serverConfig';
import { appEvents, EVENTS } from './appEvents';

/**
 * The HTTP client every service goes through — same plumbing as ambel-mobile's
 * services/apiClient: bearer token, branch scope header, FormData handling, a
 * 401 that signs the app out, and one readable error message.
 *
 * The base URL follows the login screen's server picker (lib/serverConfig).
 */
const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

onApiBaseUrlChange(url => { api.defaults.baseURL = url; });

api.interceptors.request.use(config => {
  const token = storage.getTokenSync();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Branch scoping precedence:
  // 1. `x-skip-branch` flag → no branch scope (super-admin cross-branch view)
  // 2. caller-provided `x-branch-id` → used as-is
  // 3. otherwise the branch the app is currently viewing
  const branchId = storage.getBranchIdSync();
  if (config.headers['x-skip-branch']) {
    delete config.headers['x-skip-branch'];
    delete config.headers['x-branch-id'];
  } else if (!config.headers['x-branch-id'] && branchId) {
    config.headers['x-branch-id'] = branchId;
  }

  // React Native is not a "standard browser env", so axios leaves our
  // Content-Type in place for FormData bodies. Setting multipart/form-data by
  // hand omits the boundary and the server can't parse the body — dropping the
  // header lets RN's XHR generate `multipart/form-data; boundary=...` itself.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
    config.timeout = 60_000; // uploads need more headroom than the default
  }

  return config;
});

/** NestJS sends validation errors as an array of messages. */
function messageOf(error: any): string {
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join('\n');
  if (typeof message === 'string' && message) return message;
  if (!error.response) return `Can’t reach the server (${getApiBaseUrl()}).`;
  return error.message ?? 'Something went wrong';
}

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

api.interceptors.response.use(
  response => response.data,
  error => {
    const status: number | undefined = error.response?.status;
    // No refresh endpoint — an expired or foreign token means signing in again.
    // Login itself answers 401 for a wrong password, which must not bounce the
    // login screen.
    if (status === 401 && !String(error.config?.url ?? '').includes('/auth/login')) {
      appEvents.emit(EVENTS.AUTH_LOGOUT);
    }
    return Promise.reject(new ApiError(messageOf(error), status));
  },
);

/** Typed helpers: the response interceptor already unwraps `.data`. */
export const http = {
  get:    <T>(url: string, config?: AxiosRequestConfig) => api.get<T, T>(url, config),
  post:   <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => api.post<T, T>(url, data, config),
  put:    <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => api.put<T, T>(url, data, config),
  patch:  <T>(url: string, data?: unknown, config?: AxiosRequestConfig) => api.patch<T, T>(url, data, config),
  delete: <T>(url: string, config?: AxiosRequestConfig) => api.delete<T, T>(url, config),
};

export default api;
