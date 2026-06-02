import axios from 'axios';
import { storage } from './storage';

export const BASE_URL = 'https://beige-dove-181357.hostingersite.com/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await storage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const branchId = await storage.getBranchId();
  if (branchId) config.headers['x-branch-id'] = branchId;

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
