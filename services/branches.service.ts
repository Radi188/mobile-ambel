import { Branch, PageQuery, Paginated } from '../types/api.types';
import { db, delay, fail, nextId, nowIso, paginate } from './mock/store';

export type BranchPayload = {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
};

export type BranchQuery = PageQuery & { search?: string; activeOnly?: boolean };

// Branch management is system-level — super admins only.
export const branchesService = {
  /**
   * GET /branches?active=true → Branch[]
   *
   * Reference data, deliberately unpaginated: pickers, filters and forms all
   * need the whole list at once. The management screen uses `list()` instead.
   */
  getBranches: (activeOnly?: boolean) =>
    delay(activeOnly ? db.branches.filter(branch => branch.isActive) : [...db.branches]),

  /** GET /branches?page=&limit=&search= → Paginated<Branch> */
  list: ({ search, activeOnly, page = 1, limit = 20 }: BranchQuery = {}): Promise<Paginated<Branch>> => {
    const needle = search?.trim().toLowerCase();
    const filtered = db.branches.filter(branch => {
      if (activeOnly && !branch.isActive) return false;
      if (needle && !`${branch.name} ${branch.address ?? ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    return delay(paginate(filtered, page, limit));
  },

  create: (dto: BranchPayload) => {
    const branch: Branch = {
      _id: nextId('br'),
      name: dto.name,
      address: dto.address,
      phone: dto.phone,
      email: dto.email,
      isActive: dto.isActive ?? true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.branches.push(branch);
    return delay(branch);
  },

  update: (id: string, dto: Partial<BranchPayload>) => {
    const branch = db.branches.find(b => b._id === id);
    if (!branch) fail('Branch not found.');
    Object.assign(branch, dto, { updatedAt: nowIso() });
    return delay(branch);
  },

  remove: (id: string) => {
    const index = db.branches.findIndex(b => b._id === id);
    if (index < 0) fail('Branch not found.');
    db.branches.splice(index, 1);
    return delay(undefined as void);
  },
};
