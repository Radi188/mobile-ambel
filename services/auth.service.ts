import { storage } from '../lib/storage';
import { AuthUser, LoginResponse, User } from '../types/api.types';
import { branchIdOf, db, delay, fail, findUserById, roleOf } from './mock/store';

/**
 * Mock authentication.
 *
 * Any password is accepted — the username picks the account. Use an email
 * ("admin@bongpos.com"), its local part ("admin", "manager.ttpc"), a full name,
 * or just a role word: "manager" and "cashier" sign in as the first account of
 * that role, anything else as the super admin.
 */

const TOKEN_PREFIX = 'mock.';

function toAuthUser(user: User): AuthUser {
  const branchId = branchIdOf(user.branch);
  return {
    userId: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    branchId: branchId || undefined,
  };
}

function matchUser(username: string): User | undefined {
  const needle = username.trim().toLowerCase();
  const flat = needle.replace(/\s+/g, '');

  return (
    db.users.find(u => u.email.toLowerCase() === needle) ??
    db.users.find(u => u.email.split('@')[0].toLowerCase() === needle) ??
    db.users.find(u => u.name.toLowerCase().replace(/\s+/g, '') === flat) ??
    db.users.find(u => u.role === roleOf(needle) && u.isActive)
  );
}

export const authService = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    if (!username.trim() || !password.trim()) fail('Enter your username and password.');

    const user = matchUser(username);
    if (!user) fail('No account matches that username.');
    if (!user.isActive) fail('This account is inactive.');

    return delay({ accessToken: `${TOKEN_PREFIX}${user._id}`, user: toAuthUser(user) });
  },

  me: async (): Promise<AuthUser> => {
    const token = await storage.getToken();
    const id = token?.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : '';
    const user = (id && findUserById(id)) || db.users[0];
    return delay(toAuthUser(user), 80);
  },
};
