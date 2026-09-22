import { BillingCycle, PlanCatalog, Subscription } from '../types/api.types';
import { billing, db, delay } from './mock/store';

/**
 * Billing. Display-only for now: the app shows what a configuration costs and
 * records a change request — no payment processor is wired up, so nothing here
 * charges anyone.
 *
 * Endpoints this expects once billing exists:
 *   GET  /billing/catalog       → PlanCatalog
 *   GET  /billing/subscription  → Subscription
 *   POST /billing/requests      { cycle, branches } → Subscription
 */

const CATALOG: PlanCatalog = {
  currency: 'USD',
  // $15/month list, half off while the launch promotion runs.
  base: { listPrice: 15, price: 7.5, includedBranches: 1 },
  extraBranch: { listPrice: 5, price: 2.5 },
  discountLabel: '50% off',
  yearly: {
    monthsCharged: 12,
    perks: ['BongMenu digital menu', 'Three menu themes to choose from'],
  },
  included: [
    'Installation & setup',
    'Staff training',
    'Data entry',
    'Support & maintenance',
  ],
  platforms: ['Phone', 'Tablet', 'Desktop app', 'Web app'],
  notYetAvailable: ['Stock & inventory'],
};

export type ChangeRequest = {
  cycle: BillingCycle;
  /** Total branches wanted, including the one the base plan covers. */
  branches: number;
};

export const subscriptionService = {
  getCatalog: (): Promise<PlanCatalog> => delay(CATALOG, 90),

  getSubscription: (): Promise<Subscription> => delay({ ...billing.subscription }, 120),

  /**
   * Records what the customer asked for. The mock applies it immediately; a real
   * backend would raise a request for the team to confirm, and the screen's copy
   * says exactly that.
   */
  requestChange: ({ cycle, branches }: ChangeRequest): Promise<Subscription> => {
    billing.subscription = {
      ...billing.subscription,
      cycle,
      branches: Math.max(1, branches),
    };
    return delay({ ...billing.subscription }, 260);
  },

  /** Convenience for the plan screen's "you have N branches" line. */
  getBranchCount: (): Promise<number> => delay(db.branches.length, 60),
};

/** Monthly cost of a configuration, at list price and at the promo price. */
export function priceFor(catalog: PlanCatalog, branches: number) {
  const extra = Math.max(0, branches - catalog.base.includedBranches);
  const monthly = catalog.base.price + extra * catalog.extraBranch.price;
  const listMonthly = catalog.base.listPrice + extra * catalog.extraBranch.listPrice;

  return {
    extra,
    monthly,
    listMonthly,
    yearly: monthly * catalog.yearly.monthsCharged,
    listYearly: listMonthly * catalog.yearly.monthsCharged,
    savingPerMonth: listMonthly - monthly,
  };
}
