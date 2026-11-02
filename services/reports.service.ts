import { byBackend } from './backend';
import { bongposReports } from './bongpos/reports';
import { ambelReports } from './ambel/reports';

export { normaliseBranchReport, normaliseSalesReport, normaliseShiftReport } from './shape';

export type ReportFilter = {
  dateFrom?: string;
  dateTo?: string;
  /** Admin's every-branch view (x-skip-branch), as ambel-mobile's admins see. */
  allBranches?: boolean;
};

/**
 * "All time" as an explicit range. The live API does not read a missing range
 * as "everything" — ask without dates and it answers for its default window
 * (today), so an all-time total read $0 the day after the last sale.
 */
export const ALL_TIME_FROM = '2020-01-01';
export function allTimeRange(): ReportFilter {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { dateFrom: ALL_TIME_FROM, dateTo: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
}

export const reportsService = byBackend<typeof bongposReports>({ bongpos: bongposReports, ambel: ambelReports });
