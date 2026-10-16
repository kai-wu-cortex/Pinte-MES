/** Convert spreadsheet wall-clock dates to ISO without inventing missing dates. */
export function convertWpsDateValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? '' : raw.toISOString();
  const text = String(raw).normalize('NFKC').trim();
  if (!text) return '';

  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial <= 0 || serial >= 80000) return '';
    // Excel serials have no timezone. Keep their displayed local date and time,
    // including afternoon times that would otherwise shift into the next day.
    const parts = new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000));
    return new Date(parts.getUTCFullYear(), parts.getUTCMonth(), parts.getUTCDate(),
      parts.getUTCHours(), parts.getUTCMinutes(), parts.getUTCSeconds(), parts.getUTCMilliseconds()).toISOString();
  }

  const normalized = text.replace(/年|月/g, '-').replace(/日/g, '')
    .replace(/时|分/g, ':').replace(/秒/g, '').replace(/:$/, '');
  const match = normalized.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?)?$/);
  if (match) {
    const [, y, m, d, hh = '0', mm = '0', ss = '0', fraction = '0'] = match;
    const [year, month, day, hour, minute, second] = [y, m, d, hh, mm, ss].map(Number);
    const date = new Date(year, month - 1, day, hour, minute, second, Number(fraction.padEnd(3, '0')));
    // Date constructors silently roll invalid dates such as February 30 forward.
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ||
      date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) return '';
    return date.toISOString();
  }

  // Only timezone-qualified ISO timestamps use native parsing; arbitrary text
  // must not be interpreted differently by different browsers.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  return '';
}
