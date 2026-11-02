import { http } from '../../lib/api';
import { AuthUser, LoginResponse } from '../../types/api.types';
import { recordOf } from '../shape';
import { toAuthUser } from './shape';

/**
 * api-ambel — src/auth
 *
 * POST /auth/login  { username, password }
 *                   → { accessToken, user: { id, name, username, email, role, branch, branchId } }
 * GET  /auth/me     → the token's payload { userId, name, username, role, branchId }
 */
export const ambelAuth = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const data: any = recordOf(await http.post('/auth/login', {
      username: username.trim().toLowerCase(),
      password,
    }));
    if (!data?.accessToken) throw new Error('The server did not return a session.');
    return { accessToken: data.accessToken, user: toAuthUser(data.user) };
  },

  me: async (): Promise<AuthUser> => toAuthUser(recordOf(await http.get('/auth/me'))),
};
