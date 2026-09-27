import { http } from '../lib/api';
import { Branch, PageQuery, Paginated } from '../types/api.types';
import { listOf, matches, normaliseBranch, paginate, recordOf } from './shape';

export type BranchPayload = {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
};

export type BranchQuery = PageQuery & { search?: string; activeOnly?: boolean };

// Every branch the tenant has — not scoped to the one the app is viewing.
const fetchAll = async () =>
  listOf(await http.get('/branches', { headers: { 'x-skip-branch': '1' } })).map(normaliseBranch);

/**
 * GET    /branches        the tenant's branches (from the token)
 * POST   /branches        create
 * PATCH  /branches/:id    edit
 * DELETE /branches/:id    remove
 */
export const branchesService = {
  /**
   * Reference data, deliberately unpaginated: pickers, filters and forms all
   * need the whole list at once. The management screen uses `list()` instead.
   */
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
    normaliseBranch(recordOf(await http.post('/branches', dto))),

  update: async (id: string, dto: Partial<BranchPayload>) =>
    normaliseBranch(recordOf(await http.patch(`/branches/${id}`, dto))),

  remove: async (id: string) => { await http.delete(`/branches/${id}`); },
};
