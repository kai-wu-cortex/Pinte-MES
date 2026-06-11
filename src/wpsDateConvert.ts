/**
 * Convert a raw WPS cell value to an ISO date string.
 *
 * Returns '' for blank, unparseable, or non-date values.
 * Never falls back to the current date — that would silently overwrite
 * real spreadsheet dates and make "今日筛选" return wrong rows.
 *
 * Supports:
 *  - ISO strings: "2025-01-15", "2025-01-15T08:00:00.000Z"
 *  - Slash dates: "2025/1/15", "2025/01/15 08:00"
 *  - Chinese dates: "2025年1月15日"
 *  - Excel serial numbers: "45672" (days since 1899-12-30)
 */
export function convertWpsDateValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  // Excel serial date number (e.g. "45672" or "45672.5")
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    // Plausible Excel date serial range: ~1900-01-01 (1) .. ~2100 (73415)
    if (serial > 0 && serial < 80000) {
      const epoch = Date.UTC(1899, 11, 30);
      const ms = epoch + serial * 86400000;
      const date = new Date(ms);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    return '';
  }

  // Chinese date format: 2025年1月15日 [08时30分]
  const cnMatch = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2})[时:](\d{1,2})(?:[分:](\d{1,2}))?)?/);
  if (cnMatch) {
    const [, y, m, d, hh = '0', mm = '0', ss = '0'] = cnMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    if (!isNaN(date.getTime())) return date.toISOString();
    return '';
  }

  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return '';
  return date.toISOString();
}
