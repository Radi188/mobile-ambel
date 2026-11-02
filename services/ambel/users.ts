import { http } from '../../lib/api';
import { Branch, Paginated, User } from '../../types/api.types';
import type { UserPayload, UserQuery } from '../users.service';
import { listOf, matches, paginate, recordOf } from '../shape';
import { normaliseUser } from './shape';
import { ambelBranches } from './branches';

const branchIdOf = (user: User) =>
  typeof user.branch === 'object' && user.branch ? user.branch._id : (user.branch as string | null) ?? '';

/**
 * App form → `POST/PATCH /users`. Accounts sign in by username; email is an
 * optional contact (an empty one fails `@IsEmail`, so it's left out).
 */
function toUserPayload(dto: Partial<UserPayload>) {
  const payload: Record<string, unknown> = {};
  if (dto.name !== undefined) payload.name = dto.name.trim();
  if (dto.username !== undefined) payload.username = dto.username.trim().toLowerCase();
  if (dto.email?.trim()) payload.email = dto.email.trim().toLowerCase();
  if (dto.role) payload.role = dto.role;
  if (dto.isActive !== undefined) payload.isActive = dto.isActive;
  if (dto.branch) payload.branch = dto.branch;
  return payload;
}

/**
 * api-ambel — src/users
 *
 * GET    /users?role=&branch=&search=   (a manager only ever sees their branch)
 * POST   /users             { name, username, email?, password, role, branch?, isActive }
 * PATCH  /users/:id         same, without password
 * PATCH  /users/:id/password { password }
 * DELETE /users/:id         (super admin)
 */
export const ambelUsers = {
  getUsers: async ({ role, branch, search, page = 1, limit = 20 }: UserQuery = {}): Promise<Paginated<User>> => {
    const data = await http.get('/users', { params: { role, branch, search } });
    const list = listOf(data).map(normaliseUser).filter(user => {
      if (role && user.role !== role) return false;
      if (branch && branchIdOf(user) !== branch) return false;
      return matches(search, user.name, user.username, user.email);
    });
    return paginate(list, page, limit);
  },

  /**
   * Without a branch the server falls back to the request's branch scope, so
   * the viewed branch is skipped: a manager's token still puts staff in their
   * own branch, and a super admin's new super admin isn't tied to one.
   */
  create: async (dto: UserPayload) => {
    if (!dto.username?.trim()) throw new Error('A username is required.');
    const body = { ...toUserPayload(dto), password: dto.password };
    return normaliseUser(recordOf(await http.post('/users', body, { headers: { 'x-skip-branch': '1' } })));
  },

  update: async (id: string, dto: Partial<UserPayload>) =>
    normaliseUser(recordOf(await http.patch(`/users/${id}`, toUserPayload(dto)))),

  changePassword: (id: string, password: string) =>
    http.patch(`/users/${id}/password`, { password }),

  remove: async (id: string) => { await http.delete(`/users/${id}`); },

  getBranches: (): Promise<Branch[]> => ambelBranches.getBranches(),
};
