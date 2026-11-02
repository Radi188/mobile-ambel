import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Chips, Sheet, TextField } from './ui';
import { allTimeRange } from '../services/reports.service';
import { localDate } from '../services/dashboard.service';
import { colors, space, text } from '../constants/theme';

/**
 * A date range picked from presets (today, this week, …) or typed in a sheet —
 * the control the reports and orders screens share. Dates are YYYY-MM-DD in
 * the device's timezone.
 */

export type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'last30' | 'all' | 'custom';
export type DateRange = { dateFrom: string; dateTo: string };

export function presetRange(key: Exclude<DatePreset, 'custom'>): DateRange {
  if (key === 'all') return allTimeRange() as DateRange;
  const now = new Date();
  if (key === 'yesterday') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { dateFrom: localDate(y), dateTo: localDate(y) };
  }
  const start = new Date(now);
  if (key === 'week') start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
  if (key === 'month') start.setDate(1);
  if (key === 'last30') start.setDate(now.getDate() - 30);
  return { dateFrom: localDate(start), dateTo: localDate(now) };
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  month: 'This month',
  last30: 'Last 30 days',
  all: 'All time',
  custom: 'Custom',
};

export const DEFAULT_PRESETS: DatePreset[] = ['today', 'yesterday', 'week', 'month', 'last30', 'all', 'custom'];

export function shortDate(iso: string): string {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** The range in words, for a sentence or a heading: "today", "this week", "Mar 1 – Mar 7". */
export function rangeLabel(preset: DatePreset, range: DateRange): string {
  if (preset !== 'custom') return PRESET_LABELS[preset].toLowerCase();
  return range.dateFrom === range.dateTo
    ? shortDate(range.dateFrom)
    : `${shortDate(range.dateFrom)} – ${shortDate(range.dateTo)}`;
}

/** The chip row. "Custom" opens the sheet, and once applied shows the range it holds. */
export function DateRangeChips({ preset, range, onChange, presets = DEFAULT_PRESETS, sheetSubtitle }: {
  preset: DatePreset;
  range: DateRange;
  onChange: (preset: DatePreset, range: DateRange) => void;
  presets?: DatePreset[];
  sheetSubtitle?: string;
}) {
  const [open, setOpen] = useState(false);

  const options = presets.map(key => ({
    key,
    label: key === 'custom' && preset === 'custom'
      ? `${shortDate(range.dateFrom)} – ${shortDate(range.dateTo)}`
      : PRESET_LABELS[key],
  }));

  const choose = (key: DatePreset) => {
    if (key === 'custom') { setOpen(true); return; }
    onChange(key, presetRange(key));
  };

  return (
    <>
      <Chips options={options} value={preset} onChange={choose} />
      <RangeSheet
        visible={open}
        current={range}
        subtitle={sheetSubtitle}
        onApply={r => onChange('custom', r)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

// ─── Custom range sheet ───────────────────────────────────────────────────────

const isValidDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// Keeps typing in YYYY-MM-DD shape without a native picker dependency.
function formatInput(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  if (digits.length > 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return digits;
}

function RangeSheet({ visible, current, subtitle, onApply, onClose }: {
  visible: boolean;
  current: DateRange;
  subtitle?: string;
  onApply: (r: DateRange) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(current.dateFrom);
  const [to, setTo] = useState(current.dateTo);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setFrom(current.dateFrom);
    setTo(current.dateTo);
    setProblem(null);
  }, [visible]);

  const apply = () => {
    if (!isValidDate(from) || !isValidDate(to)) { setProblem('Use the YYYY-MM-DD format, e.g. 2026-01-31.'); return; }
    if (from > to) { setProblem('The start date is after the end date.'); return; }
    onApply({ dateFrom: from, dateTo: to });
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Custom range"
      subtitle={subtitle}
      footer={<Button label="Apply" size="lg" style={s.flex} onPress={apply} />}
    >
      <View style={s.dates}>
        <TextField
          label="From"
          value={from}
          onChangeText={v => setFrom(formatInput(v))}
          placeholder="YYYY-MM-DD"
          keyboardType="number-pad"
          icon="calendar-outline"
          maxLength={10}
          style={s.flex}
        />
        <TextField
          label="To"
          value={to}
          onChangeText={v => setTo(formatInput(v))}
          placeholder="YYYY-MM-DD"
          keyboardType="number-pad"
          icon="calendar-outline"
          maxLength={10}
          style={s.flex}
        />
      </View>
      {!!problem && <Text style={[text.caption, s.problem]}>{problem}</Text>}
    </Sheet>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  dates: { flexDirection: 'row', gap: space.md },
  problem: { color: colors.text, fontWeight: '600', marginTop: space.md },
});
