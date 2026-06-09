import assert from 'node:assert/strict';
import { getNextDailySyncDelayMs } from './syncSchedule';

const minute = 60 * 1000;

assert.equal(
  getNextDailySyncDelayMs(new Date('2026-06-09T12:29:00')),
  1 * minute,
);

assert.equal(
  getNextDailySyncDelayMs(new Date('2026-06-09T12:31:00')),
  269 * minute,
);

assert.equal(
  getNextDailySyncDelayMs(new Date('2026-06-09T17:01:00')),
  1169 * minute,
);
