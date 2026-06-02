import api from '../lib/api';
import { User, UserRole, Branch } from '../types/api.types';

export type UserPayload = {
  name: string;
  email: string;
  password?: string;
  role?: UserRole;
  branch?: string;
  isActive?: boolean;
};

export const usersService = {
  // Super admins see all users (optionally filtered); managers are scoped to their branch.
  getUsers: (role?: UserRole, branch?: string, search?: string) =>
    api.get('/users', { params: { role, branch, search } }) as unknown as Promise<User[]>,

  create: (dto: UserPayload) =>
    api.post('/users', dto) as unknown as Promise<User>,

  update: (id: string, dto: Partial<UserPayload>) =>
    api.patch(`/users/${id}`, dto) as unknown as Promise<User>,

  changePassword: (id: string, password: string) =>
    api.patch(`/users/${id}/password`, { password }) as unknown as Promise<{ message: string }>,

  remove: (id: string) =>
    api.delete(`/users/${id}`) as unknown as Promise<void>,

  getBranches: () =>
    api.get('/branches') as unknown as Promise<Branch[]>,
};
