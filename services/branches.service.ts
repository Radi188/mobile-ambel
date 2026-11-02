import { PageQuery } from '../types/api.types';
import { byBackend } from './backend';
import { bongposBranches } from './bongpos/branches';
import { ambelBranches } from './ambel/branches';

export type BranchPayload = {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
};

export type BranchQuery = PageQuery & { search?: string; activeOnly?: boolean };

export const branchesService = byBackend<typeof bongposBranches>({ bongpos: bongposBranches, ambel: ambelBranches });
