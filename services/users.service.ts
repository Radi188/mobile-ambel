import { Branch, PageQuery, Paginated, User, UserRole } from '../types/api.types';
import { branchIdOf, db, delay, fail, nextId, nowIso, paginate } from './mock/store';

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

function resolveBranch(id?: string): Branch | null {
  if (!id) return null;
  return db.branches.find(branch => branch._id === id) ?? null;
}

export const usersService = {
  /** GET /users?page=&limit=&role=&branch=&search= → Paginated<User> */
  getUsers: ({ role, branch, search, page = 1, limit = 20 }: UserQuery = {}): Promise<Paginated<User>> => {
    const needle = search?.trim().toLowerCase();
    const list = db.users.filter(user => {
      if (role && user.role !== role) return false;
      if (branch && branchIdOf(user.branch) !== branch) return false;
      if (needle && !`${user.name} ${user.email}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    return delay(paginate(list, page, limit));
  },

  create: (dto: UserPayload) => {
    if (db.users.some(user => user.email.toLowerCase() === dto.email.toLowerCase())) {
      fail('That email is already in use.');
    }
    const user: User = {
      _id: nextId('usr'),
      name: dto.name,
      email: dto.email,
      role: dto.role ?? 'cashier',
      branch: resolveBranch(dto.branch),
      isActive: dto.isActive ?? true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.users.push(user);
    return delay(user);
  },

  update: (id: string, dto: Partial<UserPayload>) => {
    const user = db.users.find(u => u._id === id);
    if (!user) fail('User not found.');
    const { branch, password, ...rest } = dto;
    Object.assign(user, rest, { updatedAt: nowIso() });
    if (branch !== undefined) user.branch = resolveBranch(branch);
    return delay(user);
  },

  // Passwords aren't stored in the mock backend; the call just has to succeed.
  changePassword: (_id: string, _password: string) =>
    delay({ message: 'Password updated' }),

  remove: (id: string) => {
    const index = db.users.findIndex(user => user._id === id);
    if (index < 0) fail('User not found.');
    db.users.splice(index, 1);
    return delay(undefined as void);
  },

  getBranches: () => delay([...db.branches]),
};
