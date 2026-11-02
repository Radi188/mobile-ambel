import { PageQuery, UserRole } from '../types/api.types';
import { byBackend } from './backend';
import { bongposUsers } from './bongpos/users';
import { ambelUsers } from './ambel/users';

export type UserQuery = PageQuery & {
  role?: UserRole;
  branch?: string;
  search?: string;
};

export type UserPayload = {
  name: string;
  email: string;
  /** Ambel signs in by username; BongPOS ignores it. */
  username?: string;
  password?: string;
  role?: UserRole;
  branch?: string;
  isActive?: boolean;
};

export const usersService = byBackend<typeof bongposUsers>({ bongpos: bongposUsers, ambel: ambelUsers });
