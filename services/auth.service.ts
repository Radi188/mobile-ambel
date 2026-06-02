import api from '../lib/api';
import { AuthUser, LoginResponse } from '../types/api.types';

export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }) as unknown as Promise<LoginResponse>,

  me: () =>
    api.get('/auth/me') as unknown as Promise<AuthUser>,
};
