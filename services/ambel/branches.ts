import { ApiError, http } from '../../lib/api';
import { Branch, Paginated } from '../../types/api.types';
import type { BranchPayload, BranchQuery } from '../branches.service';
import { listOf, matches, normaliseBranch, paginate, recordOf } from '../shape';

const SKIP_BRANCH = { 'x-skip-branch': '1' };

/**
 * Every branch. `GET /branches` is super-admin only; a manager or cashier gets
 * the public list the digital menu uses instead — active branches only, which
 * is all a picker or a "your branch" label needs. A server without the menu
 * module yet answers that with a 404, and then there's no list to show.
 */
async function fetchAll(): Promise<Branch[]> {
  try {
    return listOf(await http.get('/branches', { headers: SKIP_BRANCH })).map(normaliseBranch);
  } catch (e) {
    if ((e as ApiError)?.status !== 403) throw e;
    return listOf(await http.get('/menu/branches', { headers: SKIP_BRANCH }).catch(() => [])).map(normaliseBranch);
  }
}

/** Only the DTO's fields — the API rejects anything else. An empty email fails `@IsEmail`. */
function toBranchPayload({ name, address, phone, email, isActive }: Partial<BranchPayload>) {
  return Object.fromEntries(
    Object.entries({ name, address, phone, email: email || undefined, isActive }).filter(([, v]) => v !== undefined),
  );
}

/**
 * api-ambel — src/branches (super admin)
 *
 * GET    /branches        every branch
 * POST   /branches        create
 * PATCH  /branches/:id    edit
 * DELETE /branches/:id    remove
 * GET    /menu/branches   public, active branches (fallback for non-admins)
 */
export const ambelBranches = {
  getBranches: async (activeOnly?: boolean): Promise<Branch[]> => {
    const all = await fetchAll();
    return activeOnly ? all.filter(b => b.isActive) : all;
  },

  list: async ({ search, activeOnly, page = 1, limit = 20 }: BranchQuery = {}): Promise<Paginated<Branch>> => {
    const all = await fetchAll();
    const filtered = all.filter(b =>
      (!activeOnly || b.isActive) && matches(search, b.name, b.address));
    return paginate(filtered, page, limit);
  },

  create: async (dto: BranchPayload) =>
    normaliseBranch(recordOf(await http.post('/branches', toBranchPayload(dto)))),

  update: async (id: string, dto: Partial<BranchPayload>) =>
    normaliseBranch(recordOf(await http.patch(`/branches/${id}`, toBranchPayload(dto)))),

  remove: async (id: string) => { await http.delete(`/branches/${id}`); },
};
