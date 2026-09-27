import { http } from '../lib/api';
import { AuthUser, LoginResponse } from '../types/api.types';
import { recordOf, toAuthUser } from './shape';

/**
 * POST /auth/login  { email, password }
 *                   → { accessToken, user: { id, email, fullName, clientId,
 *                       branchId, role: { id, name } } }
 * GET  /auth/me     → the signed-in account (flat `roleName`)
 */
export const authService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const data: any = recordOf(await http.post('/auth/login', {
      email: email.trim().toLowerCase(),
      password,
    }));
    if (!data?.accessToken) throw new Error('The server did not return a session.');
    return { accessToken: data.accessToken, user: toAuthUser(data.user) };
  },

  me: async (): Promise<AuthUser> => toAuthUser(recordOf(await http.get('/auth/me'))),
};
