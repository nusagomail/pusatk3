import type { ScheduleSummary } from '@pusatk3/shared';

// Display helpers for directory data (Indonesian UI). Dates are calendar dates "YYYY-MM-DD"
// without a time zone, so they are formatted from their parts, never through `Date` + local time.

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];
const MONTHS_LONG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

function parts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

/** "2027-01-11" → "11 Jan 2027" (or "11 Januari 2027" with `long`). */
export function formatDate(date: string, { long = false } = {}): string {
  const { year, month, day } = parts(date);
  const names = long ? MONTHS_LONG : MONTHS_SHORT;
  return `${day} ${names[month - 1]} ${year}`;
}

/** Date range: "11–22 Jan 2027", "28 Jan – 3 Feb 2027", "30 Des 2026 – 2 Jan 2027", "11 Jan 2027". */
export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatDate(start);
  const a = parts(start);
  const b = parts(end);
  if (a.year === b.year && a.month === b.month) {
    return `${a.day}–${b.day} ${MONTHS_SHORT[a.month - 1]} ${a.year}`;
  }
  if (a.year === b.year) {
    return `${a.day} ${MONTHS_SHORT[a.month - 1]} – ${b.day} ${MONTHS_SHORT[b.month - 1]} ${a.year}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

/** Date block on cards: month and days ("JAN", "11–22"). */
export function dateBlock(start: string, end: string): { month: string; days: string } {
  const a = parts(start);
  const b = parts(end);
  const sameMonth = a.year === b.year && a.month === b.month;
  return {
    month: MONTHS_SHORT[a.month - 1]?.toUpperCase() ?? '',
    days: start === end ? String(a.day) : sameMonth ? `${a.day}–${b.day}` : `${a.day}+`,
  };
}

/** 5500000 → "Rp5.500.000"; null → "Harga: tanyakan penyedia". */
export function formatPrice(priceIdr: number | null): string {
  if (priceIdr === null) return 'Harga: tanyakan penyedia';
  return `Rp${priceIdr.toLocaleString('id-ID')}`;
}

export const ISSUER_LABELS: Record<ScheduleSummary['issuer'], string> = {
  kemnaker: 'Kemnaker',
  bnsp: 'BNSP',
  pupr: 'PUPR',
  esdm: 'ESDM',
  intl: 'Internasional',
};

export const MODE_LABELS: Record<ScheduleSummary['mode'], string> = {
  offline: 'Tatap muka',
  online: 'Online',
};

/** `training_only` must never read as an official license (constants.ts). */
export const CERTIFICATE_LABELS: Record<ScheduleSummary['certificateKind'], string> = {
  official: 'Sertifikat/lisensi resmi',
  training_only: 'Sertifikat pelatihan (bukan lisensi)',
};

export const PROVIDER_TYPE_LABELS: Record<ScheduleSummary['provider']['type'], string> = {
  pjk3: 'PJK3',
  lsp: 'LSP',
  tuk: 'TUK',
};
