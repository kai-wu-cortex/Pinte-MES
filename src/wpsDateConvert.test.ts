import assert from 'node:assert/strict';
import { convertWpsDateValue } from './wpsDateConvert';

// Blank / undefined / null must never become "today"
assert.equal(convertWpsDateValue(''), '');
assert.equal(convertWpsDateValue('   '), '');
assert.equal(convertWpsDateValue(undefined), '');
assert.equal(convertWpsDateValue(null), '');

// Non-date text must never become "today"
assert.equal(convertWpsDateValue('涂布'), '');
assert.equal(convertWpsDateValue('不是日期'), '');
assert.equal(convertWpsDateValue('A1'), '');

// Valid ISO must round-trip and keep its year (regression: 2025 must stay 2025)
const iso2025 = convertWpsDateValue('2025-01-15T08:00:00.000Z');
assert.equal(iso2025, '2025-01-15T08:00:00.000Z');
assert.equal(new Date(iso2025).getUTCFullYear(), 2025);

// Slash-style dates (commonly seen in WPS export) should parse and keep their year
const slash = convertWpsDateValue('2025/1/15');
assert.notEqual(slash, '');
assert.equal(new Date(slash).getFullYear(), 2025);

// Chinese formatted date
const cn = convertWpsDateValue('2025年1月15日');
assert.notEqual(cn, '');
assert.equal(new Date(cn).getFullYear(), 2025);
assert.equal(new Date(cn).getMonth(), 0);
assert.equal(new Date(cn).getDate(), 15);

const cnWithTime = convertWpsDateValue('2025年6月10日 08时30分');
assert.notEqual(cnWithTime, '');
assert.equal(new Date(cnWithTime).getHours(), 8);
assert.equal(new Date(cnWithTime).getMinutes(), 30);

// Excel serial date (45672 ≈ 2025-01-14 UTC)
const serial = convertWpsDateValue('45672');
assert.notEqual(serial, '');
assert.equal(new Date(serial).getUTCFullYear(), 2025);

// Tiny integers that look like row numbers should NOT become 1900-ish dates being treated
// as today — but they should at least not become *today*. Our function maps them to early
// 1900s which `isTaskOnDate(today)` will reject as not-today. That's acceptable.
const ten = convertWpsDateValue('10');
// Either '' or some valid ISO is acceptable, but it must NOT equal today's ISO date
const todayPrefix = new Date().toISOString().slice(0, 10);
assert.notEqual(ten.slice(0, 10), todayPrefix);

console.log('wpsDateConvert tests passed');
