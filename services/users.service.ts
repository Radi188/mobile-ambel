import { http } from '../lib/api';
import { Branch, PageQuery, Paginated, User, UserRole } from '../types/api.types';
import { listOf, matches, normaliseRole, normaliseUser, paginate, recordOf } from './shape';
import { branchesService } from './branches.service';

export type UserQuery = PageQuery & {
  role?: UserRole;
  branch?: string;
  search?: string;
};

export type UserPayload = {
  name: string;
  email: string;
  password?: string;
  role?: UserRole;
  branch?: string;
  isActive?: boolean;
};

const branchIdOf = (user: User) =>
  typeof user.branch === 'object' && user.branch ? user.branch._id : (user.branch as string | null) ?? '';

/**
 * The server assigns a role by id, from GET /roles. The app picks by name
 * (super_admin | manager | cashier), so the name is looked up here.
 */
async function roleIdFor(role: UserRole): Promise<string> {
  const roles = listOf(await http.get('/roles'));
  const match = roles.find((r: any) => normaliseRole(r) === role);
  if (!match) throw new Error(`This server has no “${role.replace('_', ' ')}” role.`);
  return String(match.id ?? match._id);
}

/**
 * GET    /users                 the staff list
 * POST   /users                 { email, password, fullName, roleId, branchId? }
 * PATCH  /users/:id             { fullName, isActive }
 * PATCH  /users/:id/role        { roleId }
 * PATCH  /users/:id/password    { password }
 * DELETE /users/:id
 */
export const usersService = {
  getUsers: async ({ role, branch, search, page = 1, limit = 20 }: UserQuery = {}): Promise<Paginated<User>> => {
    const list = listOf(await http.get('/users')).map(normaliseUser).filter(user => {
      if (role && user.role !== role) return false;
      if (branch && branchIdOf(user) !== branch) return false;
      return matches(search, user.name, user.email);
    });
    return paginate(list, page, limit);
  },

  create: async (dto: UserPayload) => {
    const body = {
      email: dto.email.trim().toLowerCase(),
      password: dto.password,
      fullName: dto.name.trim(),
      roleId: await roleIdFor(dto.role ?? 'cashier'),
    };
    // ambel-mobile doesn't send a branch, so the DTO may refuse one ("property
    // branchId should not exist") — then the account is created without it.
    if (!dto.branch) return normaliseUser(recordOf(await http.post('/users', body)));
    try {
      return normaliseUser(recordOf(await http.post('/users', { ...body, branchId: dto.branch })));
    } catch (e: any) {
      if (!/branchId should not exist/i.test(e?.message ?? '')) throw e;
      return normaliseUser(recordOf(await http.post('/users', body)));
    }
  },

  /**
   * The role has its own route, so changing a name can't quietly change
   * someone's permissions along the way — it's only called when it changed.
   */
  update: async (id: string, dto: Partial<UserPayload>) => {
    let user = normaliseUser(recordOf(await http.patch(`/users/${id}`, {
      ...(dto.name !== undefined ? { fullName: dto.name.trim() } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    })));
    if (dto.role && dto.role !== user.role) {
      const roleId = await roleIdFor(dto.role);
      user = normaliseUser(recordOf(await http.patch(`/users/${id}/role`, { roleId })));
    }
    return user;
  },

  changePassword: (id: string, password: string) =>
    http.patch(`/users/${id}/password`, { password }),

  remove: async (id: string) => { await http.delete(`/users/${id}`); },

  getBranches: (): Promise<Branch[]> => branchesService.getBranches(),
};
